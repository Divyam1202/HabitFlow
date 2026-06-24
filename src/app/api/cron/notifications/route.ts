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

// Convert HH:MM time string to minutes from midnight (0 to 1439)
function timeToMinutes(timeStr: string): number {
  if (!timeStr) return -1;
  const parts = timeStr.split(':').map(Number);
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return -1;
  return parts[0] * 60 + parts[1];
}

// Normalize minutes to [0, 1439] range
function normalizeMinutes(m: number): number {
  return (m % 1440 + 1440) % 1440;
}

// Check if current minutes is within [targetMinutes, targetMinutes + windowSize] with midnight wrap-around
function isTimeInWindow(current: number, target: number, windowSize = 15): boolean {
  if (target === -1) return false;
  const diff = (current - target + 1440) % 1440;
  return diff >= 0 && diff < windowSize;
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

  console.log('[Cron Started]');
  try {
    await connectMongo();

    const users = await UserState.find({ fcmToken: { $exists: true, $ne: "" } });
    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, message: 'No users with FCM tokens found' });
    }

    let notificationsSent = 0;
    const now = new Date();

    for (const user of users) {
      console.log(`[User Processed] User ID: ${user.userId}`);
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
            console.log(`[Habit Evaluated] Habit: "${habit.name}" (ID: ${habit.id}) (Snoozed)`);
            console.log(`[Match Found] Habit: "${habit.name}" (ID: ${habit.id}) matching snooze for user ${user.userId}`);
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

              console.log(`[FCM Send Attempted] Message: ${JSON.stringify(message)}`);
              const fcmResponse = await adminMessaging.send(message);
              console.log(`[FCM Send Success] Message ID: ${fcmResponse}`);
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
              console.log(`[FCM Send Failed] Error: ${pushErr.message || pushErr}`);
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

              if (
                pushErr.code === 'messaging/registration-token-not-registered' ||
                pushErr.code === 'messaging/invalid-registration-token' ||
                pushErr.code === 'messaging/invalid-argument' ||
                (pushErr.httpResponse && (pushErr.httpResponse.status === 404 || pushErr.httpResponse.status === 400))
              ) {
                console.log(`[Cron] Stale FCM token detected for user ${user.userId}. Unsetting token in database.`);
                await UserState.updateOne(
                  { userId: user.userId },
                  {
                    $unset: { fcmToken: "" },
                    $set: {
                      notificationStatus: "invalid_token",
                      lastNotificationFailure: new Date(),
                      lastNotificationFailureReason: pushErr.code || "messaging/registration-token-not-registered"
                    }
                  }
                );
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

      // Query notifications sent to this user in the last 36 hours to cover timezone diffs
      const windowStart = new Date(now.getTime() - 36 * 60 * 60 * 1000);
      const sentNotifications = await Notification.find({
        userId: user.userId,
        createdAt: { $gte: windowStart }
      }).lean();

      // Get current date string in user's timezone (YYYY-MM-DD)
      const userDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: userTimezone }).format(new Date());

      // ── Process regular habits ────────────────────────────────────────
      for (const habit of habits) {
        console.log(`[Habit Evaluated] Habit: "${habit.name}" (ID: ${habit.id})`);
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

        if (!isScheduledToday) {
          continue;
        }

        const currentMinutes = timeToMinutes(currentTimeHHMM);
        const habitMinutes = timeToMinutes(habit.time);
        if (currentMinutes === -1 || habitMinutes === -1) continue;

        const retryEnabled = habit.notifPrefs?.retry !== false;

        // Target times in minutes
        const initialTargetRaw = habitMinutes - offset;
        const exactTargetRaw = offset > 0 ? habitMinutes : -1;
        const retry1TargetRaw = retryEnabled ? (habitMinutes - offset + 15) : -1;
        const retry2TargetRaw = retryEnabled ? (habitMinutes - offset + 45) : -1;

        // Normalized to [0, 1439]
        const initialTarget = normalizeMinutes(initialTargetRaw);
        let exactTarget = exactTargetRaw !== -1 ? normalizeMinutes(exactTargetRaw) : -1;
        let retry1Target = retry1TargetRaw !== -1 ? normalizeMinutes(retry1TargetRaw) : -1;
        let retry2Target = retry2TargetRaw !== -1 ? normalizeMinutes(retry2TargetRaw) : -1;

        // Resolve overlaps
        if (exactTarget === retry1Target) {
          exactTarget = -1; // Let retry1 handle it
        }
        if (exactTarget === retry2Target) {
          exactTarget = -1; // Let retry2 handle it
        }

        // Window matching (15 minutes window size)
        const isDue = isTimeInWindow(currentMinutes, initialTarget, 15);
        const isExactMatch = exactTarget !== -1 && isTimeInWindow(currentMinutes, exactTarget, 15);
        const isReRemind1 = retry1Target !== -1 && isTimeInWindow(currentMinutes, retry1Target, 15);
        const isReRemind2 = retry2Target !== -1 && isTimeInWindow(currentMinutes, retry2Target, 15);

        const habitSentNotifs = sentNotifications.filter(n => String(n.habitId) === String(habit.id));
        const hasBeenSentToday = (expectedRetryCount: number) => {
          return habitSentNotifs.some(n => {
            const nDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: userTimezone }).format(new Date(n.createdAt));
            return nDateStr === userDateStr && n.retryCount === expectedRetryCount;
          });
        };

        console.log(`[Cron Eval] User: ${user.userId} | Timezone: ${userTimezone} | Current Time: ${currentTimeHHMM}`);
        console.log(`[Cron Eval] Habit: "${habit.name}" (ID: ${habit.id}) | Time: ${habit.time} | Frequency: ${JSON.stringify(habit.frequency)} | Scheduled Today: ${isScheduledToday} | Completed: ${isCompleted}`);
        console.log(`[Cron Eval] Target times -> Due: ${initialTarget}, Exact: ${exactTarget}, ReRemind1: ${retry1Target}, ReRemind2: ${retry2Target}`);
        console.log(`[Cron Eval] Match outcomes -> isDue: ${isDue}, isExactMatch: ${isExactMatch}, isReRemind1: ${isReRemind1}, isReRemind2: ${isReRemind2}`);

        let triggerMatched = false;
        let retryCount = 0;
        let copyType: 'initial' | 'retry1' | 'retry2' = 'initial';

        if (isDue && !hasBeenSentToday(0)) {
          triggerMatched = true;
          retryCount = 0;
          copyType = 'initial';
        } else if (isExactMatch && !hasBeenSentToday(3)) {
          triggerMatched = true;
          retryCount = 3;
          copyType = 'initial';
        } else if (isReRemind1 && !hasBeenSentToday(1)) {
          triggerMatched = true;
          retryCount = 1;
          copyType = 'retry1';
        } else if (isReRemind2 && !hasBeenSentToday(2)) {
          triggerMatched = true;
          retryCount = 2;
          copyType = 'retry2';
        }

        if (triggerMatched) {
          console.log(`[Match Found] Habit: "${habit.name}" (ID: ${habit.id}) matching type ${copyType} for user ${user.userId}`);
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

          if ((copyType === 'retry1' || copyType === 'retry2') && !retryEnabled) {
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

            console.log(`[FCM Send Attempted] Message: ${JSON.stringify(message)}`);
            const fcmResponse = await adminMessaging.send(message);
            console.log(`[FCM Send Success] Message ID: ${fcmResponse}`);
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
            console.log(`[FCM Send Failed] Error: ${error.message || error}`);
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

            if (
              error.code === 'messaging/registration-token-not-registered' ||
              error.code === 'messaging/invalid-registration-token' ||
              error.code === 'messaging/invalid-argument' ||
              (error.httpResponse && (error.httpResponse.status === 404 || error.httpResponse.status === 400))
            ) {
              console.log(`[Cron] Stale FCM token detected for user ${user.userId}. Unsetting token in database.`);
              await UserState.updateOne(
                { userId: user.userId },
                {
                  $unset: { fcmToken: "" },
                  $set: {
                    notificationStatus: "invalid_token",
                    lastNotificationFailure: new Date(),
                    lastNotificationFailureReason: error.code || "messaging/registration-token-not-registered"
                  }
                }
              );
            }
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
