import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import Notification from '@/models/Notification'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { notificationId } = await req.json()
    if (!notificationId) return NextResponse.json({ error: 'notificationId required' }, { status: 400 })

    await connectToDatabase()

    await Notification.findOneAndUpdate(
      { _id: notificationId, userId: session.user.id, status: { $in: ['delivered', 'pending'] } },
      { status: 'opened', openedAt: new Date() }
    )

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
