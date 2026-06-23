import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import TelemetryEvent from '@/models/TelemetryEvent'
import Notification from '@/models/Notification'
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
