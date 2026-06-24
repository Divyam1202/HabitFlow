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

    // Fetch all users diagnostics
    const allUsers = await UserState.find({}).lean()
    const usersDiagnostics = allUsers.map((u: any) => ({
      userId: u.userId,
      hasFcmToken: !!u.fcmToken,
      tokenLength: u.fcmToken ? u.fcmToken.length : 0,
      timezone: u.timezone || 'Asia/Kolkata',
      lastTokenRefresh: u.updatedAt || u.createdAt
    }))

    // Fetch latest sent and delivered logs globally or for the user
    const lastSentLog = await NotificationLog.findOne({ status: { $in: ['sent', 'delivered'] } })
      .sort({ createdAt: -1 })
      .lean()

    const lastDeliveredLog = await NotificationLog.findOne({ status: 'delivered' })
      .sort({ createdAt: -1 })
      .lean()

    return NextResponse.json({
      success: true,
      fcmTokenRegistered,
      lastNotificationDelivered,
      timezone: userState?.timezone || 'UTC',
      usersDiagnostics,
      lastNotificationSentTime: lastSentLog ? lastSentLog.createdAt : null,
      lastNotificationDeliveredTime: lastDeliveredLog ? lastDeliveredLog.createdAt : null
    })
  } catch (error: any) {
    console.error('Error checking notification health:', error)
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 })
  }
}
