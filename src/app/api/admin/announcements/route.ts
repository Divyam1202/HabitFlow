import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { auth } from '@/lib/auth'
import Announcement from '@/models/Announcement'
import AuditLog from '@/models/AuditLog'
import Notification from '@/models/Notification'
import UserState from '@/models/UserState'
import { adminMessaging } from '@/lib/firebase-admin'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // Both users and admins can fetch announcements (filtered by audience for users)
    const session = await auth.api.getSession({ headers: req.headers })
    const isAdmin = !!session?.user && session.user.email?.toLowerCase() === 'habytflow@gmail.com'

    await connectToDatabase()

    // Admins see all announcements; general users see only public notices.
    const announcements = isAdmin
      ? await Announcement.find().sort({ createdAt: -1 }).lean()
      : await Announcement.find({ audience: 'ALL_USERS' }).sort({ createdAt: -1 }).lean()

    const formatted = announcements.map((a) => ({
      id: a._id.toString(),
      title: a.title,
      message: a.message,
      type: a.type,
      audience: a.audience,
      createdAt: a.createdAt
    }))

    return NextResponse.json({ announcements: formatted })
  } catch (error) {
    console.error('Error fetching announcements:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminCheck = await requireAdmin(req)
    if (!adminCheck) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title, message, type, audience } = await req.json()
    if (!title || !message || !type || !audience) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    if (!['NEW_FEATURE', 'MAINTENANCE', 'BUG_FIXES', 'UPDATE_NOTES'].includes(type)) {
      return NextResponse.json({ error: 'Invalid announcement type' }, { status: 400 })
    }

    if (!['ALL_USERS', 'PREMIUM_USERS', 'INACTIVE_USERS'].includes(audience)) {
      return NextResponse.json({ error: 'Invalid audience segment' }, { status: 400 })
    }

    await connectToDatabase()
    const announcement = await Announcement.create({
      title,
      message,
      type,
      audience,
      createdById: adminCheck.user.id
    })

    const announcementId = String(announcement._id)
    const now = new Date()
    const activeUsers = await UserState.find({
      notificationStatus: { $ne: 'inactive' }
    }).select({ userId: 1, fcmToken: 1 }).lean()

    // Persist one unread notification per eligible user so it appears in the
    // notification feed even when push permission is unavailable.
    await Notification.insertMany(
      activeUsers.map((user) => ({
        userId: user.userId,
        habitId: `announcement:${announcementId}`,
        habitName: 'Announcement',
        category: 'announcement',
        notificationType: 'announcement',
        announcementId,
        title,
        body: message,
        scheduledFor: now,
        localDateKey: `announcement:${announcementId}`,
        status: 'delivered',
        retryCount: 0,
        deliveredAt: now
      }))
    )

    // Push delivery is best-effort. A stale token must not prevent the
    // announcement from being saved or appearing in the in-app feed.
    const pushUsers = activeUsers.filter((user) => user.fcmToken)
    const pushResults = await Promise.allSettled(
      pushUsers.map((user) => adminMessaging.send({
        token: user.fcmToken!,
        data: {
          title,
          body: message,
          category: 'announcement',
          notificationType: 'announcement',
          announcementId,
          actionUrl: '/'
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'announcements',
            defaultSound: true
          }
        },
        apns: { payload: { aps: { sound: 'default' } } },
        webpush: { headers: { Urgency: 'high' } }
      }))
    )

    const staleTokenUserIds = pushResults.flatMap((result, index) => {
      if (result.status !== 'rejected') return []
      const errorCode = (result.reason as { code?: string })?.code
      if (errorCode === 'messaging/registration-token-not-registered' || errorCode === 'messaging/invalid-registration-token') {
        return [pushUsers[index].userId]
      }
      console.error(`Failed to send announcement push to user ${pushUsers[index].userId}:`, result.reason)
      return []
    })

    if (staleTokenUserIds.length > 0) {
      await UserState.updateMany(
        { userId: { $in: staleTokenUserIds } },
        { $unset: { fcmToken: '' }, $set: { notificationStatus: 'invalid_token', lastNotificationFailure: now } }
      )
    }

    await AuditLog.create({
      adminId: adminCheck.user.id,
      adminEmail: adminCheck.user.email,
      action: 'ANNOUNCEMENT_PUBLISHED',
      details: `Published announcement: "${title}" for audience: ${audience}`
    })

    return NextResponse.json({
      success: true,
      announcement,
      notificationsCreated: activeUsers.length,
      pushesAttempted: pushUsers.length,
      pushesSent: pushResults.filter((result) => result.status === 'fulfilled').length
    })
  } catch (error) {
    console.error('Error creating announcement:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
