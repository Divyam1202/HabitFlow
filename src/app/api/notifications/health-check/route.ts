import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { auth } from '@/lib/auth'
import UserState from '@/models/UserState'
import Notification from '@/models/Notification'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    await connectToDatabase()

    const userState = await UserState.findOne({ userId })
    const fcmTokenRegistered = !!(userState?.fcmToken)

    const lastNotif = await Notification.findOne({ userId })
      .sort({ scheduledFor: -1 })
      .lean()

    const lastNotificationDelivered = lastNotif ? lastNotif.status !== 'expired' : false

    return NextResponse.json({
      success: true,
      fcmTokenRegistered,
      lastNotificationDelivered,
      timezone: userState?.timezone || 'UTC'
    })
  } catch (error: any) {
    console.error('Error checking notification health:', error)
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 })
  }
}
