import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import UserState from '@/models/UserState'
import TelemetryEvent from '@/models/TelemetryEvent'
import Notification from '@/models/Notification'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { habitId, notificationId } = await req.json()
    if (!habitId) return NextResponse.json({ error: 'habitId is required' }, { status: 400 })

    await connectToDatabase()

    // Update user state — mark habit done
    const userState = await UserState.findOne({ userId: session.user.id })
    if (!userState?.stateData) return NextResponse.json({ error: 'User state not found' }, { status: 404 })

    let state: any = {}
    try { state = JSON.parse(userState.stateData) } catch {
      return NextResponse.json({ error: 'Failed to parse user state' }, { status: 500 })
    }

    const parsedHabitId = Number(habitId)
    if (isNaN(parsedHabitId)) return NextResponse.json({ error: 'Invalid habitId' }, { status: 400 })

    if (!state.todayHabits) state.todayHabits = []
    if (!state.todayHabits.includes(parsedHabitId)) state.todayHabits.push(parsedHabitId)

    let habitName = '', category = ''
    if (state.gridData) {
      state.gridData = state.gridData.map((h: any) => {
        if (h.id !== parsedHabitId) return h
        habitName = h.name
        category = h.category
        const newDays = [...(h.days || [])]
        const lastIdx = newDays.length - 1
        if (lastIdx >= 0) newDays[lastIdx] = { ...newDays[lastIdx], completed: true }
        return { ...h, days: newDays }
      })
    }

    userState.stateData = JSON.stringify(state)
    await userState.save()

    // Update Notification record if provided
    if (notificationId) {
      await Notification.findByIdAndUpdate(notificationId, {
        status: 'completed',
        completedAt: new Date(),
      }).catch(() => { /* non-critical */ })
    } else {
      // Best-effort: update latest unresolved notification for this habit
      await Notification.findOneAndUpdate(
        { userId: session.user.id, habitId: String(habitId), status: { $in: ['delivered', 'pending', 'opened'] } },
        { status: 'completed', completedAt: new Date() },
        { sort: { createdAt: -1 } }
      ).catch(() => { /* non-critical */ })
    }

    const logData = { habitName: habitName || `Habit #${habitId}`, category: category || 'growth' }
    await new TelemetryEvent({ eventType: 'notification_completed', metadata: logData }).save()
    await new TelemetryEvent({ eventType: 'habit_completed', metadata: logData }).save()

    return NextResponse.json({ success: true, habitName })
  } catch (error) {
    console.error('Error completing habit via notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
