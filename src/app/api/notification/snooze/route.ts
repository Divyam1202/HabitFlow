import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import TelemetryEvent from '@/models/TelemetryEvent'
import Notification from '@/models/Notification'
import NotificationLog from '@/models/NotificationLog'
import UserState from '@/models/UserState'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Snooze durations in minutes
const SNOOZE_DURATIONS: Record<string, number> = {
  '15m': 15,
  '30m': 30,
  '1h':  60,
  'tomorrow': 24 * 60,
}

function getCurrentTimeInTimezone(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
  } catch {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
  }
}

function addMinutesToHHMM(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const date = new Date()
  date.setHours(h, m + mins)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { habitId, habitName, category, notificationId, duration = '15m' } = await req.json()

    await connectToDatabase()

    const snoozeMins = SNOOZE_DURATIONS[duration] ?? 15
    const snoozedUntil = new Date(Date.now() + snoozeMins * 60 * 1000)

    // Update Notification record
    if (notificationId) {
      await Notification.findByIdAndUpdate(notificationId, { status: 'snoozed', snoozedUntil }).catch(() => {})
    } else {
      await Notification.findOneAndUpdate(
        { userId: session.user.id, habitId: String(habitId), status: { $in: ['delivered', 'pending', 'opened'] } },
        { status: 'snoozed', snoozedUntil },
        { sort: { createdAt: -1 } }
      ).catch(() => {})
    }

    const userState = await UserState.findOne({ userId: session.user.id })
    const userTimezone = userState?.timezone || 'Asia/Kolkata'
    const currentTime = getCurrentTimeInTimezone(userTimezone)

    await NotificationLog.create({
      userId: session.user.id,
      habitId: String(habitId),
      habitName: habitName || `Habit #${habitId}`,
      notificationId: notificationId || undefined,
      scheduledTime: currentTime,
      triggerTime: currentTime,
      timezone: userTimezone,
      status: 'snoozed'
    }).catch(err => console.error("Failed to write snoozed notif log:", err))

    // Store snooze trigger time in user stateData (for cron to pick up)
    if (duration !== 'tomorrow') {
      if (userState?.stateData) {
        try {
          const state = JSON.parse(userState.stateData)
          const triggerTime = addMinutesToHHMM(currentTime, snoozeMins)
          if (!state.snoozedReminders) state.snoozedReminders = []
          // Remove any existing snooze for this habit then add new
          state.snoozedReminders = state.snoozedReminders.filter((s: any) => s.habitId !== Number(habitId))
          state.snoozedReminders.push({ habitId: Number(habitId), triggerTime })
          userState.stateData = JSON.stringify(state)
          await userState.save()
        } catch { /* non-critical */ }
      }
    }

    await new TelemetryEvent({
      eventType: 'notification_snoozed',
      metadata: { habitName: habitName || `Habit #${habitId}`, category: category || 'growth', duration }
    }).save()

    return NextResponse.json({ success: true, snoozedUntil })
  } catch (error) {
    console.error('Error logging notification snooze:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
