import { NextResponse } from 'next/server';
import { connectToDatabase as connectMongo } from '@/lib/db';
import UserState from '@/models/UserState';
import TelemetryEvent from '@/models/TelemetryEvent';
import Notification from '@/models/Notification';
import { adminMessaging } from '@/lib/firebase-admin';

// Helper to get current time in a specific timezone (HH:mm)
function getCurrentTimeInTimezone(timezone: string): string {
  try {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    };
    return new Intl.DateTimeFormat('en-GB', options).format(new Date());
  } catch {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    };
    return new Intl.DateTimeFormat('en-GB', options).format(new Date());
  }
}

// Helper to map habit category to standard channels
function mapCategoryToChannel(category: string): string {
  const cat = category.toLowerCase();
  if (cat.includes('health') || cat.includes('gym') || cat.includes('sport') || cat.includes('hydration') || cat.includes('diet') || cat.includes('water')) return 'health';
  if (cat.includes('career') || cat.includes('building') || cat.includes('work') || cat.includes('project')) return 'career';
  if (cat.includes('growth') || cat.includes('read') || cat.includes('learn') || cat.includes('code') || cat.includes('study')) return 'growth';
  if (cat.includes('spiritual') || cat.includes('yoga') || cat.includes('meditat') || cat.includes('pray') || cat.includes('mindfulness')) return 'spiritual';
  if (cat.includes('home') || cat.includes('laundry') || cat.includes('clean') || cat.includes('chore')) return 'home';
  return 'growth';
}

// Helper to calculate the notification target time based on the offset
function calculateTargetTime(timeHHMM: string, offsetMinutes: number): string {
  if (!timeHHMM) return '';
  const [hours, minutes] = timeHHMM.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return '';

  const date = new Date();
  date.setHours(hours);
  date.setMinutes(minutes - offsetMinutes);

  const targetHours = String(date.getHours()).padStart(2, '0');
  const targetMinutes = String(date.getMinutes()).padStart(2, '0');
  return `${targetHours}:${targetMinutes}`;
}

// Build personal, specific notification copy
function buildNotificationCopy(habit: any, type: 'initial' | 'retry1' | 'retry2' | 'snooze'): { title: string; body: string } {
  const catChannel = mapCategoryToChannel(habit.category);
  const emoji = catChannel === 'health' ? '🏋️' : catChannel === 'career' ? '🚀' : catChannel === 'growth' ? '📖' : catChannel === 'spiritual' ? '🧘' : catChannel === 'home' ? '🏠' : '⭐';

  switch (type) {
    case 'initial':
      return { title: `${emoji} ${habit.name}`, body: `Time to ${habit.name.toLowerCase()}. Your streak is counting on you.` };
    case 'retry1':
      return { title: `${emoji} ${habit.name} — Reminder`, body: `Still time to complete ${habit.name}. Protect your streak.` };
    case 'retry2':
      return { title: `${emoji} ${habit.name} — Last Call`, body: `Last reminder for ${habit.name} today. Don't break your streak!` };
    case 'snooze':
      return { title: `${emoji} ${habit.name} — Snoozed`, body: `Your snooze is up. Let's get ${habit.name.toLowerCase()} done!` };
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'fallback_cron_token_1202'}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectMongo();

    const users = await UserState.find({ fcmToken: { $exists: true, $ne: "" } });
    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, message: 'No users with FCM tokens found' });
    }

    let notificationsSent = 0;
    const now = new Date();

    for (const user of users) {
      if (!user.stateData) continue;

      let parsed: any = {};
      try {
        parsed = JSON.parse(user.stateData);
      } catch {
        console.error('Failed to parse stateData for user', user.userId);
        continue;
      }

      const habits = parsed.gridData || [];
      const todayHabits = parsed.todayHabits || [];
      const snoozedReminders = parsed.snoozedReminders || [];
      const categoryPrefs: Record<string, { enabled: boolean }> = parsed.categoryPrefs || {};

      const userTimezone = user.timezone || 'Asia/Kolkata';
      const currentTimeHHMM = getCurrentTimeInTimezone(userTimezone);

      // ── Process snoozed reminders ─────────────────────────────────────
      let snoozedUpdated = false;
      const remainingSnoozes = [];

      for (const snooze of snoozedReminders) {
        const isCompleted = todayHabits.includes(snooze.habitId);

        if (snooze.triggerTime === currentTimeHHMM) {
          snoozedUpdated = true;
          if (!isCompleted) {
            const habit = habits.find((h: any) => h.id === snooze.habitId);
            if (habit) {
              // Check category pref
              const channel = mapCategoryToChannel(habit.category);
              if (categoryPrefs[channel]?.enabled === false) continue;

              // Check habit-level push pref
              if (habit.notifPrefs?.push === false) continue;

              try {
                const copy = buildNotificationCopy(habit, 'snooze');
                const notifRecord = await Notification.create({
                  userId: user.userId,
                  habitId: String(habit.id),
                  habitName: habit.name,
                  category: channel,
                  title: copy.title,
                  body: copy.body,
                  scheduledFor: now,
                  status: 'delivered',
                  retryCount: 0,
                  deliveredAt: now,
                });

                const message: any = {
                  notification: { title: copy.title, body: copy.body },
                  token: user.fcmToken,
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
                        scheduledTime: habit.time,
                        notificationId: String(notifRecord._id),
                        actionUrl: '/'
                      }
                    }
                  }
                };

                await adminMessaging.send(message);
                notificationsSent++;

                try {
                  await new TelemetryEvent({ eventType: 'notification_delivered', metadata: { habitName: habit.name, category: channel } }).save();
                } catch { /* non-critical */ }
              } catch (pushErr) {
                console.error(`Failed to send snoozed FCM push:`, pushErr);
              }
            }
          }
        } else {
          remainingSnoozes.push(snooze);
        }
      }

      if (snoozedUpdated) {
        parsed.snoozedReminders = remainingSnoozes;
        user.stateData = JSON.stringify(parsed);
        await user.save();
      }

      // ── Process regular habits ────────────────────────────────────────
      for (const habit of habits) {
        const isCompleted = todayHabits.includes(habit.id);
        if (isCompleted) continue;

        // Check category pref
        const channel = mapCategoryToChannel(habit.category);
        if (categoryPrefs[channel]?.enabled === false) continue;

        // Check habit-level push pref
        if (habit.notifPrefs?.push === false) continue;

        const offset = (habit.notification === null || habit.notification === undefined) ? 0 : habit.notification;

        const targetTimeHHMM  = calculateTargetTime(habit.time, offset);
        const targetTimePlus15 = calculateTargetTime(habit.time, offset - 15);
        const targetTimePlus45 = calculateTargetTime(habit.time, offset - 45);

        const isDue          = currentTimeHHMM === targetTimeHHMM;
        const isReRemind1    = currentTimeHHMM === targetTimePlus15;
        const isReRemind2    = currentTimeHHMM === targetTimePlus45;
        const isExactMatch   = offset !== 0 && habit.time === currentTimeHHMM;

        // Check retry pref — if retry disabled, only fire initial
        const retryEnabled = habit.notifPrefs?.retry !== false;
        if ((isReRemind1 || isReRemind2) && !retryEnabled) continue;

        if (isDue || isReRemind1 || isReRemind2 || isExactMatch) {
          const retryCount = isReRemind2 ? 2 : isReRemind1 ? 1 : 0;
          const copyType = retryCount === 2 ? 'retry2' : retryCount === 1 ? 'retry1' : 'initial';

          try {
            const copy = buildNotificationCopy(habit, copyType);
            const notifRecord = await Notification.create({
              userId: user.userId,
              habitId: String(habit.id),
              habitName: habit.name,
              category: channel,
              title: copy.title,
              body: copy.body,
              scheduledFor: now,
              status: 'delivered',
              retryCount,
              deliveredAt: now,
            });

            const message: any = {
              notification: { title: copy.title, body: copy.body },
              token: user.fcmToken,
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
                    scheduledTime: habit.time,
                    notificationId: String(notifRecord._id),
                    actionUrl: '/'
                  }
                }
              }
            };

            await adminMessaging.send(message);
            notificationsSent++;
            console.log(`[Cron] Sent notification (${copyType}) for habit: ${habit.name} → user: ${user.userId} (${userTimezone})`);

            try {
              await new TelemetryEvent({ eventType: 'notification_delivered', metadata: { habitName: habit.name, category: channel } }).save();
            } catch { /* non-critical */ }
          } catch (error) {
            console.error(`Failed to send FCM to user ${user.userId}:`, error);
          }
        }
      }
    }

    return NextResponse.json({ success: true, notificationsSent });

  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
