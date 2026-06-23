import { NextResponse } from 'next/server';
import { connectToDatabase as connectMongo } from '@/lib/db';
import UserState from '@/models/UserState';
import TelemetryEvent from '@/models/TelemetryEvent';
import Notification from '@/models/Notification';
import NotificationLog from '@/models/NotificationLog';
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

// Normalize time strings to compare numeric hours and minutes to avoid timezone format issues
function parseHHMM(timeStr: string): { hours: number; minutes: number } | null {
  if (!timeStr) return null;
  const parts = timeStr.split(':').map(Number);
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  return { hours: parts[0], minutes: parts[1] };
}

function timesMatch(timeA: string, timeB: string): boolean {
  const parsedA = parseHHMM(timeA);
  const parsedB = parseHHMM(timeB);
  if (!parsedA || !parsedB) return false;
  return parsedA.hours === parsedB.hours && parsedA.minutes === parsedB.minutes;
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
          const habit = habits.find((h: any) => h.id === snooze.habitId);
          if (habit) {
            const channel = mapCategoryToChannel(habit.category);

            // Log: scheduled, evaluated, triggered
            await NotificationLog.create({
              userId: user.userId,
              habitId: String(habit.id),
              habitName: habit.name,
              scheduledTime: snooze.triggerTime,
              triggerTime: currentTimeHHMM,
              timezone: userTimezone,
              status: 'scheduled'
            });

            await NotificationLog.create({
              userId: user.userId,
              habitId: String(habit.id),
              habitName: habit.name,
              scheduledTime: snooze.triggerTime,
              triggerTime: currentTimeHHMM,
              timezone: userTimezone,
              status: 'evaluated'
            });

            await NotificationLog.create({
              userId: user.userId,
              habitId: String(habit.id),
              habitName: habit.name,
              scheduledTime: snooze.triggerTime,
              triggerTime: currentTimeHHMM,
              timezone: userTimezone,
              status: 'matched'
            });

            if (isCompleted) {
              await NotificationLog.create({
                userId: user.userId,
                habitId: String(habit.id),
                habitName: habit.name,
                scheduledTime: snooze.triggerTime,
                triggerTime: currentTimeHHMM,
                timezone: userTimezone,
                status: 'failed',
                errorMessage: 'Habit Already Completed'
              });
              continue;
            }

            // Check category pref
            if (categoryPrefs[channel]?.enabled === false) {
              await NotificationLog.create({
                userId: user.userId,
                habitId: String(habit.id),
                habitName: habit.name,
                scheduledTime: snooze.triggerTime,
                triggerTime: currentTimeHHMM,
                timezone: userTimezone,
                status: 'failed',
                errorMessage: 'Category Preference Disabled'
              });
              continue;
            }

            // Check habit-level push pref
            if (habit.notifPrefs?.push === false) {
              await NotificationLog.create({
                userId: user.userId,
                habitId: String(habit.id),
                habitName: habit.name,
                scheduledTime: snooze.triggerTime,
                triggerTime: currentTimeHHMM,
                timezone: userTimezone,
                status: 'failed',
                errorMessage: 'Habit Push Preference Disabled'
              });
              continue;
            }

            if (!user.fcmToken) {
              await NotificationLog.create({
                userId: user.userId,
                habitId: String(habit.id),
                habitName: habit.name,
                scheduledTime: snooze.triggerTime,
                triggerTime: currentTimeHHMM,
                timezone: userTimezone,
                status: 'failed',
                errorMessage: 'Missing FCM Token'
              });
              continue;
            }

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

              // Log: sent
              await NotificationLog.create({
                userId: user.userId,
                habitId: String(habit.id),
                habitName: habit.name,
                notificationId: String(notifRecord._id),
                scheduledTime: snooze.triggerTime,
                triggerTime: currentTimeHHMM,
                timezone: userTimezone,
                status: 'sent'
              });

              const message: any = {
                notification: { title: copy.title, body: copy.body },
                data: {
                  title: copy.title,
                  body: copy.body,
                  habitId: String(habit.id),
                  habitName: String(habit.name),
                  category: String(channel),
                  scheduledTime: String(snooze.triggerTime),
                  notificationId: String(notifRecord._id),
                  actionUrl: '/'
                },
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
                      scheduledTime: snooze.triggerTime,
                      notificationId: String(notifRecord._id),
                      actionUrl: '/'
                    }
                  }
                }
              };

              await adminMessaging.send(message);
              notificationsSent++;

              // Log: delivered
              await NotificationLog.create({
                userId: user.userId,
                habitId: String(habit.id),
                habitName: habit.name,
                notificationId: String(notifRecord._id),
                scheduledTime: snooze.triggerTime,
                triggerTime: currentTimeHHMM,
                timezone: userTimezone,
                status: 'delivered'
              });

              try {
                await new TelemetryEvent({ eventType: 'notification_delivered', metadata: { habitName: habit.name, category: channel } }).save();
              } catch { /* non-critical */ }
            } catch (pushErr: any) {
              console.error(`Failed to send snoozed FCM push:`, pushErr);
              await NotificationLog.create({
                userId: user.userId,
                habitId: String(habit.id),
                habitName: habit.name,
                scheduledTime: snooze.triggerTime,
                triggerTime: currentTimeHHMM,
                timezone: userTimezone,
                status: 'failed',
                errorMessage: `Firebase Send Failure: ${pushErr.message || pushErr}`
              });
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
        const channel = mapCategoryToChannel(habit.category);

        // Safely parse offset in case it is stored as string ("15 mins") or number
        let offset = 0;
        if (habit.notification !== null && habit.notification !== undefined) {
          const parsedOffset = parseInt(String(habit.notification), 10);
          if (!isNaN(parsedOffset)) {
            offset = parsedOffset;
          }
        }

        // Check habit frequency
        const dateInUserTimezone = new Date(new Date().toLocaleString("en-US", { timeZone: userTimezone }));
        const dayOfWeek = dateInUserTimezone.getDay();
        const isScheduledToday = habit.frequency ? habit.frequency.includes(dayOfWeek) : true;

        const targetTimeHHMM  = calculateTargetTime(habit.time, offset);
        const targetTimePlus15 = calculateTargetTime(habit.time, offset - 15);
        const targetTimePlus45 = calculateTargetTime(habit.time, offset - 45);

        const isDue          = timesMatch(currentTimeHHMM, targetTimeHHMM);
        const isReRemind1    = timesMatch(currentTimeHHMM, targetTimePlus15);
        const isReRemind2    = timesMatch(currentTimeHHMM, targetTimePlus45);
        const isExactMatch   = offset !== 0 && timesMatch(habit.time, currentTimeHHMM);

        console.log(`[Cron Eval] User: ${user.userId} | Timezone: ${userTimezone} | Current Time: ${currentTimeHHMM}`);
        console.log(`[Cron Eval] Habit: "${habit.name}" (ID: ${habit.id}) | Time: ${habit.time} | Frequency: ${JSON.stringify(habit.frequency)} | Scheduled Today: ${isScheduledToday} | Completed: ${isCompleted}`);
        console.log(`[Cron Eval] Target times -> Due: ${targetTimeHHMM}, ReRemind1: ${targetTimePlus15}, ReRemind2: ${targetTimePlus45}`);
        console.log(`[Cron Eval] Match outcomes -> isDue: ${isDue}, isReRemind1: ${isReRemind1}, isReRemind2: ${isReRemind2}, isExactMatch: ${isExactMatch}`);

        if (!isScheduledToday) {
          continue;
        }

        // Check retry pref — if retry disabled, only fire initial
        const retryEnabled = habit.notifPrefs?.retry !== false;

        if (isDue || isReRemind1 || isReRemind2 || isExactMatch) {
          // Log: scheduled, evaluated, triggered
          await NotificationLog.create({
            userId: user.userId,
            habitId: String(habit.id),
            habitName: habit.name,
            scheduledTime: habit.time,
            triggerTime: currentTimeHHMM,
            timezone: userTimezone,
            status: 'scheduled'
          });

          await NotificationLog.create({
            userId: user.userId,
            habitId: String(habit.id),
            habitName: habit.name,
            scheduledTime: habit.time,
            triggerTime: currentTimeHHMM,
            timezone: userTimezone,
            status: 'evaluated'
          });

          await NotificationLog.create({
            userId: user.userId,
            habitId: String(habit.id),
            habitName: habit.name,
            scheduledTime: habit.time,
            triggerTime: currentTimeHHMM,
            timezone: userTimezone,
            status: 'matched'
          });

          if (isCompleted) {
            await NotificationLog.create({
              userId: user.userId,
              habitId: String(habit.id),
              habitName: habit.name,
              scheduledTime: habit.time,
              triggerTime: currentTimeHHMM,
              timezone: userTimezone,
              status: 'failed',
              errorMessage: 'Habit Already Completed'
            });
            continue;
          }

          if ((isReRemind1 || isReRemind2) && !retryEnabled) {
            await NotificationLog.create({
              userId: user.userId,
              habitId: String(habit.id),
              habitName: habit.name,
              scheduledTime: habit.time,
              triggerTime: currentTimeHHMM,
              timezone: userTimezone,
              status: 'failed',
              errorMessage: 'Retry Reminders Disabled'
            });
            continue;
          }

          // Check category pref
          if (categoryPrefs[channel]?.enabled === false) {
            await NotificationLog.create({
              userId: user.userId,
              habitId: String(habit.id),
              habitName: habit.name,
              scheduledTime: habit.time,
              triggerTime: currentTimeHHMM,
              timezone: userTimezone,
              status: 'failed',
              errorMessage: 'Category Preference Disabled'
            });
            continue;
          }

          // Check habit-level push pref
          if (habit.notifPrefs?.push === false) {
            await NotificationLog.create({
              userId: user.userId,
              habitId: String(habit.id),
              habitName: habit.name,
              scheduledTime: habit.time,
              triggerTime: currentTimeHHMM,
              timezone: userTimezone,
              status: 'failed',
              errorMessage: 'Habit Push Preference Disabled'
            });
            continue;
          }

          if (!user.fcmToken) {
            await NotificationLog.create({
              userId: user.userId,
              habitId: String(habit.id),
              habitName: habit.name,
              scheduledTime: habit.time,
              triggerTime: currentTimeHHMM,
              timezone: userTimezone,
              status: 'failed',
              errorMessage: 'Missing FCM Token'
            });
            continue;
          }

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

            // Log: sent
            await NotificationLog.create({
              userId: user.userId,
              habitId: String(habit.id),
              habitName: habit.name,
              notificationId: String(notifRecord._id),
              scheduledTime: habit.time,
              triggerTime: currentTimeHHMM,
              timezone: userTimezone,
              status: 'sent'
            });

            const message: any = {
              notification: { title: copy.title, body: copy.body },
              data: {
                title: copy.title,
                body: copy.body,
                habitId: String(habit.id),
                habitName: String(habit.name),
                category: String(channel),
                scheduledTime: String(habit.time),
                notificationId: String(notifRecord._id),
                actionUrl: '/'
              },
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

            // Log: delivered
            await NotificationLog.create({
              userId: user.userId,
              habitId: String(habit.id),
              habitName: habit.name,
              notificationId: String(notifRecord._id),
              scheduledTime: habit.time,
              triggerTime: currentTimeHHMM,
              timezone: userTimezone,
              status: 'delivered'
            });

            try {
              await new TelemetryEvent({ eventType: 'notification_delivered', metadata: { habitName: habit.name, category: channel } }).save();
            } catch { /* non-critical */ }
          } catch (error: any) {
            console.error(`Failed to send FCM to user ${user.userId}:`, error);
            await NotificationLog.create({
              userId: user.userId,
              habitId: String(habit.id),
              habitName: habit.name,
              scheduledTime: habit.time,
              triggerTime: currentTimeHHMM,
              timezone: userTimezone,
              status: 'failed',
              errorMessage: `Firebase Send Failure: ${error.message || error}`
            });
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
