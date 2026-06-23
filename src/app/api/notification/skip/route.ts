import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import TelemetryEvent from '@/models/TelemetryEvent'
import Notification from '@/models/Notification'
import NotificationLog from '@/models/NotificationLog'
import UserState from '@/models/UserState'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { habitId, habitName, category, notificationId } = await req.json()

    await connectToDatabase()

    // Update Notification record
    if (notificationId) {
      await Notification.findByIdAndUpdate(notificationId, { status: 'skipped' }).catch(() => {})
    } else {
      await Notification.findOneAndUpdate(
        { userId: session.user.id, habitId: String(habitId), status: { $in: ['delivered', 'pending', 'opened'] } },
        { status: 'skipped' },
        { sort: { createdAt: -1 } }
      ).catch(() => {})
    }

    const userState = await UserState.findOne({ userId: session.user.id })
    const userTimezone = userState?.timezone || 'Asia/Kolkata'
    const currentTimeHHMM = new Intl.DateTimeFormat('en-GB', {
      timeZone: userTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date())

    await NotificationLog.create({
      userId: session.user.id,
      habitId: String(habitId),
      habitName: habitName || `Habit #${habitId}`,
      notificationId: notificationId || undefined,
      scheduledTime: currentTimeHHMM,
      triggerTime: currentTimeHHMM,
      timezone: userTimezone,
      status: 'skipped'
    }).catch(err => console.error("Failed to write skipped notif log:", err))

    await new TelemetryEvent({
      eventType: 'notification_skipped',
      metadata: { habitName: habitName || `Habit #${habitId}`, category: category || 'growth' }
    }).save()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error logging notification skip:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
