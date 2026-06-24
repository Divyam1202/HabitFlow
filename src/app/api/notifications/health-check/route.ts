import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { auth } from '@/lib/auth'
import UserState from '@/models/UserState'
import Notification from '@/models/Notification'
import NotificationLog from '@/models/NotificationLog'

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

    // Own notification state only — never expose other users
    const ownDiagnostic = userState ? [{
      userId: userState.userId,
      hasFcmToken: !!userState.fcmToken,
      tokenLength: userState.fcmToken ? userState.fcmToken.length : 0,
      timezone: userState.timezone || 'Asia/Kolkata',
      lastTokenRefresh: (userState as any).lastTokenRefreshAt || (userState as any).updatedAt || (userState as any).createdAt
    }] : []

    // Fetch latest sent and delivered logs for this user only
    const lastSentLog = await NotificationLog.findOne({ userId, status: { $in: ['sent', 'delivered'] } })
      .sort({ createdAt: -1 })
      .lean()

    const lastDeliveredLog = await NotificationLog.findOne({ userId, status: 'delivered' })
      .sort({ createdAt: -1 })
      .lean()

    return NextResponse.json({
      success: true,
      fcmTokenRegistered,
      lastNotificationDelivered,
      timezone: userState?.timezone || 'UTC',
      notificationStatus: userState?.notificationStatus || 'active',
      usersDiagnostics: ownDiagnostic,
      lastNotificationSentTime: lastSentLog ? lastSentLog.createdAt : null,
      lastNotificationDeliveredTime: lastDeliveredLog ? lastDeliveredLog.createdAt : null
    })
  } catch (error: any) {
    console.error('Error checking notification health:', error)
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 })
  }
}
