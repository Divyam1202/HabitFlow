import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/lib/auth';
import UserState from '@/models/UserState';
import NotificationLog from '@/models/NotificationLog';
import Notification from '@/models/Notification';
import { adminMessaging } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

function mapCategoryToChannel(category: string): string {
  const cat = category.toLowerCase();
  if (cat.includes('health') || cat.includes('gym') || cat.includes('sport') || cat.includes('hydration') || cat.includes('diet') || cat.includes('water')) return 'health';
  if (cat.includes('career') || cat.includes('building') || cat.includes('work') || cat.includes('project')) return 'career';
  if (cat.includes('growth') || cat.includes('read') || cat.includes('learn') || cat.includes('code') || cat.includes('study')) return 'growth';
  if (cat.includes('spiritual') || cat.includes('yoga') || cat.includes('meditat') || cat.includes('pray') || cat.includes('mindfulness')) return 'spiritual';
  if (cat.includes('home') || cat.includes('laundry') || cat.includes('clean') || cat.includes('chore')) return 'home';
  return 'growth';
}

export async function POST(req: NextRequest) {
  let userId = '';
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { habitId } = await req.json();
    if (!habitId) {
      return NextResponse.json({ error: 'Missing habitId' }, { status: 400 });
    }

    userId = session.user.id;
    await connectToDatabase();

    const userState = await UserState.findOne({ userId });
    if (!userState) {
      return NextResponse.json({ error: 'UserState not found' }, { status: 404 });
    }

    let parsedState: any = {};
    try {
      if (userState.stateData) {
        parsedState = JSON.parse(userState.stateData);
      }
    } catch (e) {
      return NextResponse.json({ error: 'Failed to parse userState data' }, { status: 500 });
    }

    const habits = parsedState.gridData || [];
    // habitId could be stored as number in gridData or passed as string/number
    const habit = habits.find((h: any) => String(h.id) === String(habitId));

    if (!habit) {
      return NextResponse.json({ error: `Habit not found with ID: ${habitId}` }, { status: 404 });
    }

    if (!userState.fcmToken) {
      return NextResponse.json({ error: 'FCM Token not registered for this user' }, { status: 400 });
    }

    const channel = mapCategoryToChannel(habit.category);
    const emoji = channel === 'health' ? '🏋️' : channel === 'career' ? '🚀' : channel === 'growth' ? '📖' : channel === 'spiritual' ? '🧘' : channel === 'home' ? '🏠' : '⭐';
    
    const title = `${emoji} ${habit.name}`;
    const body = `Time to ${habit.name.toLowerCase()}. Real-time test dispatch verified.`;

    const now = new Date();
    
    // Create record in Notification collection
    const notifRecord = await Notification.create({
      userId,
      habitId: String(habit.id),
      habitName: habit.name,
      category: channel,
      title,
      body,
      scheduledFor: now,
      status: 'delivered',
      retryCount: 0,
      deliveredAt: now
    });

    // Create entry in NotificationLog
    await NotificationLog.create({
      userId,
      habitId: String(habit.id),
      habitName: habit.name,
      notificationId: String(notifRecord._id),
      scheduledTime: habit.time || 'Manual',
      triggerTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      timezone: userState.timezone || 'Asia/Kolkata',
      status: 'sent'
    });

    const message: any = {
      notification: { title, body },
      data: {
        title,
        body,
        habitId: String(habit.id),
        habitName: String(habit.name),
        category: String(channel),
        scheduledTime: habit.time || 'Manual',
        notificationId: String(notifRecord._id),
        actionUrl: '/'
      },
      token: userState.fcmToken,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: channel,
          vibrateTimingsMillis: [0, 500, 500, 500],
          defaultVibrateTimings: false,
          defaultSound: true,
          clickAction: 'HABIT_ACTIONS'
        }
      },
      apns: { payload: { aps: { sound: 'default', category: 'HABIT_ACTIONS' } } },
      webpush: {
        headers: { Urgency: 'high' },
        notification: {
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 200],
          actions: [
            { action: 'complete', title: 'Complete ✓' },
            { action: 'snooze', title: 'Snooze 15m ⏳' },
            { action: 'skip', title: 'Skip ✗' }
          ],
          data: {
            habitId: String(habit.id),
            habitName: habit.name,
            category: channel,
            scheduledTime: habit.time || 'Manual',
            notificationId: String(notifRecord._id),
            actionUrl: '/'
          }
        }
      }
    };

    const response = await adminMessaging.send(message);

    await NotificationLog.create({
      userId,
      habitId: String(habit.id),
      habitName: habit.name,
      notificationId: String(notifRecord._id),
      scheduledTime: habit.time || 'Manual',
      triggerTime: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      timezone: userState.timezone || 'Asia/Kolkata',
      status: 'delivered'
    });

    return NextResponse.json({
      success: true,
      messageId: response,
      habitName: habit.name,
      notificationId: notifRecord._id
    });

  } catch (error: any) {
    console.error('Manual habit trigger error:', error);
    if (
      error.code === 'messaging/registration-token-not-registered' ||
      error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/invalid-argument' ||
      (error.httpResponse && (error.httpResponse.status === 404 || error.httpResponse.status === 400))
    ) {
      console.log(`[Manual Trigger] Stale FCM token detected for user ${userId}. Unsetting in database.`);
      try {
        await UserState.updateOne(
          { userId },
          {
            $unset: { fcmToken: "" },
            $set: {
              notificationStatus: "invalid_token",
              lastNotificationFailure: new Date(),
              lastNotificationFailureReason: error.code || "messaging/registration-token-not-registered"
            }
          }
        );
      } catch (dbErr) {
        console.error("Failed to unset token on manual failure:", dbErr);
      }
    }
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
