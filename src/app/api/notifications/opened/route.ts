import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import Notification from '@/models/Notification'
import NotificationLog from '@/models/NotificationLog'
import UserState from '@/models/UserState'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { notificationId } = await req.json()
    if (!notificationId) return NextResponse.json({ error: 'notificationId required' }, { status: 400 })

    await connectToDatabase()

    const notif = await Notification.findOneAndUpdate(
      { _id: notificationId, userId: session.user.id, status: { $in: ['delivered', 'pending'] } },
      { status: 'opened', openedAt: new Date() }
    ).lean()

    if (notif) {
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
        habitId: notif.habitId,
        habitName: notif.habitName,
        notificationId: String(notif._id),
        scheduledTime: currentTimeHHMM,
        triggerTime: currentTimeHHMM,
        timezone: userTimezone,
        status: 'opened'
      }).catch(err => console.error("Failed to write opened notif log:", err))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error marking notification opened:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Mark all as read
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectToDatabase()

    await Notification.updateMany(
      { userId: session.user.id, status: { $in: ['delivered', 'pending'] } },
      { status: 'opened', openedAt: new Date() }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error marking all notifications read:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
