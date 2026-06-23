import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { auth } from '@/lib/auth'
import UserState from '@/models/UserState'
import NotificationLog from '@/models/NotificationLog'
import Notification from '@/models/Notification'
import { adminMessaging } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const userName = session.user.name || session.user.email || 'Test User'

    await connectToDatabase()

    const userState = await UserState.findOne({ userId })
    const userTimezone = userState?.timezone || 'Asia/Kolkata'

    const now = new Date()
    const timeHHMM = new Intl.DateTimeFormat('en-GB', {
      timeZone: userTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now)

    // Stage 1: Scheduled Log
    await NotificationLog.create({
      userId,
      habitId: 'test-habit-id',
      habitName: 'Test Habit Notification',
      scheduledTime: timeHHMM,
      triggerTime: timeHHMM,
      timezone: userTimezone,
      status: 'scheduled'
    })

    // Stage 2: Evaluated Log
    await NotificationLog.create({
      userId,
      habitId: 'test-habit-id',
      habitName: 'Test Habit Notification',
      scheduledTime: timeHHMM,
      triggerTime: timeHHMM,
      timezone: userTimezone,
      status: 'evaluated'
    })

    // Stage 3: Triggered Log
    await NotificationLog.create({
      userId,
      habitId: 'test-habit-id',
      habitName: 'Test Habit Notification',
      scheduledTime: timeHHMM,
      triggerTime: timeHHMM,
      timezone: userTimezone,
      status: 'triggered'
    })

    if (!userState || !userState.fcmToken) {
      // Stage 4: Failed Log (No Token)
      await NotificationLog.create({
        userId,
        habitId: 'test-habit-id',
        habitName: 'Test Habit Notification',
        scheduledTime: timeHHMM,
        triggerTime: timeHHMM,
        timezone: userTimezone,
        status: 'failed',
        errorMessage: 'Missing FCM Token'
      })

      return NextResponse.json({
        success: false,
        error: 'Missing FCM Token',
        details: 'You need to grant notification permissions and register an FCM token first.'
      }, { status: 400 })
    }

    // Stage 5: Sent Log
    await NotificationLog.create({
      userId,
      habitId: 'test-habit-id',
      habitName: 'Test Habit Notification',
      scheduledTime: timeHHMM,
      triggerTime: timeHHMM,
      timezone: userTimezone,
      status: 'sent'
    })

    try {
      // Create a persistent notification record in Notification model too
      const notifRecord = await Notification.create({
        userId,
        habitId: 'test-habit-id',
        habitName: 'Test Habit Notification',
        category: 'growth',
        title: '🔔 Test Habit Notification',
        body: 'Your test push succeeded! System observability matches perfectly.',
        scheduledFor: now,
        status: 'delivered',
        retryCount: 0,
        deliveredAt: now
      })

      const message: any = {
        notification: {
          title: '🔔 Test Habit Notification',
          body: 'Your test push succeeded! System observability matches perfectly.'
        },
        data: {
          title: '🔔 Test Habit Notification',
          body: 'Your test push succeeded! System observability matches perfectly.',
          habitId: 'test-habit-id',
          habitName: 'Test Habit Notification',
          category: 'growth',
          scheduledTime: timeHHMM,
          notificationId: String(notifRecord._id),
          actionUrl: '/'
        },
        token: userState.fcmToken,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'growth',
            defaultSound: true,
            clickAction: 'HABIT_ACTIONS'
          }
        },
        apns: { payload: { aps: { sound: 'default', category: 'HABIT_ACTIONS' } } },
        webpush: {
          headers: { Urgency: 'high' },
          notification: {
            requireInteraction: true,
            vibrate: [200, 100, 200],
            actions: [
              { action: 'complete', title: 'Complete ✓' },
              { action: 'snooze', title: 'Snooze 15m ⏳' },
              { action: 'skip', title: 'Skip ✗' }
            ],
            data: {
              habitId: 'test-habit-id',
              habitName: 'Test Habit Notification',
              category: 'growth',
              scheduledTime: timeHHMM,
              notificationId: String(notifRecord._id),
              actionUrl: '/'
            }
          }
        }
      }

      await adminMessaging.send(message)

      // Stage 6: Delivered Log
      await NotificationLog.create({
        userId,
        habitId: 'test-habit-id',
        habitName: 'Test Habit Notification',
        notificationId: String(notifRecord._id),
        scheduledTime: timeHHMM,
        triggerTime: timeHHMM,
        timezone: userTimezone,
        status: 'delivered'
      })

      return NextResponse.json({ success: true, message: 'Test notification sent successfully!' })
    } catch (sendErr: any) {
      // Stage 6: Failed Log (Firebase Send Failure)
      await NotificationLog.create({
        userId,
        habitId: 'test-habit-id',
        habitName: 'Test Habit Notification',
        scheduledTime: timeHHMM,
        triggerTime: timeHHMM,
        timezone: userTimezone,
        status: 'failed',
        errorMessage: `Firebase Send Failure: ${sendErr.message || sendErr}`
      })

      return NextResponse.json({
        success: false,
        error: 'Firebase Send Failure',
        details: sendErr.message || String(sendErr)
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Error sending test notification:', error)
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 })
  }
}
