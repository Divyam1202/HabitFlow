import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import UserState from '@/models/UserState'
import TelemetryEvent from '@/models/TelemetryEvent'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { habitId } = await req.json()
    if (!habitId) {
      return NextResponse.json({ error: 'habitId is required' }, { status: 400 })
    }

    await connectToDatabase()

    const userState = await UserState.findOne({ userId: session.user.id })
    if (!userState || !userState.stateData) {
      return NextResponse.json({ error: 'User state not found' }, { status: 404 })
    }

    let state: any = {}
    try {
      state = JSON.parse(userState.stateData)
    } catch (e) {
      return NextResponse.json({ error: 'Failed to parse user state' }, { status: 500 })
    }

    const parsedHabitId = Number(habitId)
    if (isNaN(parsedHabitId)) {
      return NextResponse.json({ error: 'Invalid habitId format' }, { status: 400 })
    }

    if (!state.todayHabits) state.todayHabits = []
    if (!state.todayHabits.includes(parsedHabitId)) {
      state.todayHabits.push(parsedHabitId)
    }

    let habitName = ''
    let category = ''
    if (state.gridData) {
      state.gridData = state.gridData.map((h: any) => {
        if (h.id !== parsedHabitId) return h
        habitName = h.name
        category = h.category
        const newDays = [...(h.days || [])]
        const lastIdx = newDays.length - 1
        if (lastIdx >= 0) {
          newDays[lastIdx] = { ...newDays[lastIdx], completed: true }
        }
        return { ...h, days: newDays }
      })
    }

    userState.stateData = JSON.stringify(state)
    await userState.save()

    // Log telemetry events
    const logData = {
      habitName: habitName || `Habit #${habitId}`,
      category: category || 'growth'
    }

    const notificationEvent = new TelemetryEvent({
      eventType: 'notification_completed',
      metadata: logData
    })
    await notificationEvent.save()

    const habitEvent = new TelemetryEvent({
      eventType: 'habit_completed',
      metadata: logData
    })
    await habitEvent.save()

    return NextResponse.json({ success: true, habitName })
  } catch (error) {
    console.error('Error completing habit via notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
