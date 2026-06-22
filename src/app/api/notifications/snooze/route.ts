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

    const { habitId, habitName, category } = await req.json()
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

    // Determine current time in the user's localized timezone and add 15 mins
    const userTimezone = userState.timezone || 'Asia/Kolkata'
    let triggerTime = ''
    try {
      // Create date object matching user timezone local time
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: userTimezone,
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
        hour12: false
      })
      const parts = formatter.formatToParts(new Date())
      const dateMap: Record<string, string> = {}
      parts.forEach(p => { dateMap[p.type] = p.value })

      const localDate = new Date(
        Number(dateMap.year),
        Number(dateMap.month) - 1,
        Number(dateMap.day),
        Number(dateMap.hour),
        Number(dateMap.minute),
        Number(dateMap.second)
      )
      
      // Add 15 minutes
      localDate.setMinutes(localDate.getMinutes() + 15)
      
      const targetHours = String(localDate.getHours()).padStart(2, '0')
      const targetMinutes = String(localDate.getMinutes()).padStart(2, '0')
      triggerTime = `${targetHours}:${targetMinutes}`
    } catch (tzErr) {
      console.error(`Failed to compute timezone snooze time for ${userTimezone}:`, tzErr)
      // Fallback: Use UTC + 15 mins
      const utcDate = new Date()
      utcDate.setMinutes(utcDate.getMinutes() + 15)
      const targetHours = String(utcDate.getUTCHours()).padStart(2, '0')
      const targetMinutes = String(utcDate.getUTCMinutes()).padStart(2, '0')
      triggerTime = `${targetHours}:${targetMinutes}`
    }

    const parsedHabitId = Number(habitId)
    if (!state.snoozedReminders) state.snoozedReminders = []
    state.snoozedReminders.push({
      habitId: parsedHabitId,
      triggerTime
    })

    userState.stateData = JSON.stringify(state)
    await userState.save()

    // Log telemetry
    const snoozeEvent = new TelemetryEvent({
      eventType: 'notification_snoozed',
      metadata: {
        habitName: habitName || `Habit #${habitId}`,
        category: category || 'growth'
      }
    })
    await snoozeEvent.save()

    console.log(`Created 15m snooze reminder for habit ${habitId} triggering at ${triggerTime} in ${userTimezone}`)

    return NextResponse.json({ success: true, triggerTime })
  } catch (error) {
    console.error('Error snoozing habit notification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
