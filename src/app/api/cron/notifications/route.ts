import { NextResponse } from 'next/server';
import { connectToDatabase as connectMongo } from '@/lib/db';
import UserState from '@/models/UserState';
import TelemetryEvent from '@/models/TelemetryEvent';
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
  } catch (e) {
    // Fallback to UTC if timezone is invalid
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
  return 'growth'; // default
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

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'fallback_cron_token_1202'}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectMongo();
    
    // Get all users who have registered an FCM token
    const users = await UserState.find({ fcmToken: { $exists: true, $ne: "" } });
    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, message: 'No users with FCM tokens found' });
    }

    let notificationsSent = 0;

    for (const user of users) {
      if (!user.stateData) continue;

      let parsed: any = {};
      try {
        parsed = JSON.parse(user.stateData);
      } catch (err) {
        console.error('Failed to parse stateData for user', user.userId);
        continue;
      }

      const habits = parsed.gridData || [];
      const todayHabits = parsed.todayHabits || [];
      const snoozedReminders = parsed.snoozedReminders || [];
      
      // Calculate current localized time for the user based on their stored timezone
      const userTimezone = user.timezone || 'Asia/Kolkata';
      const currentTimeHHMM = getCurrentTimeInTimezone(userTimezone);

      // Process triggered snooze reminders
      let snoozedUpdated = false;
      const remainingSnoozes = [];

      for (const snooze of snoozedReminders) {
        const isCompleted = todayHabits.includes(snooze.habitId);
        
        if (snooze.triggerTime === currentTimeHHMM) {
          snoozedUpdated = true;
          if (!isCompleted) {
            const habit = habits.find((h: any) => h.id === snooze.habitId);
            if (habit) {
              try {
                const mappedCategory = mapCategoryToChannel(habit.category);
                const message: any = {
                  notification: {
                    title: `Snoozed: ${habit.name}`,
                    body: `Your 15-minute snooze is up. Let's get this done!`,
                  },
                  token: user.fcmToken,
                  android: {
                    priority: 'high',
                    notification: {
                      sound: 'default',
                      channelId: mappedCategory,
                      vibrateTimingsMillis: [0, 500, 500, 500],
                      defaultVibrateTimings: false,
                      defaultSound: true,
                      clickAction: 'HABIT_ACTIONS'
                    }
                  },
                  apns: {
                    payload: {
                      aps: {
                        sound: 'default',
                        category: 'HABIT_ACTIONS'
                      }
                    }
                  },
                  webpush: {
                    headers: {
                      Urgency: 'high'
                    },
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
                        category: mappedCategory,
                        scheduledTime: habit.time,
                        actionUrl: '/'
                      }
                    }
                  }
                };

                await adminMessaging.send(message);
                notificationsSent++;
                console.log(`Successfully sent SNOOZED notification for habit: ${habit.name} to user: ${user.userId}`);

                try {
                  const deliveryEvent = new TelemetryEvent({
                    eventType: 'notification_delivered',
                    metadata: {
                      habitName: habit.name,
                      category: mappedCategory
                    }
                  });
                  await deliveryEvent.save();
                } catch (telemetryErr) {
                  console.error('Failed to log snooze delivery telemetry:', telemetryErr);
                }
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

      for (const habit of habits) {
        const isCompleted = todayHabits.includes(habit.id);
        
        // Skip reminder if the habit is already completed today
        if (isCompleted) continue;

        // Default to 0 offset (at time of event) if undefined or null
        const offset = (habit.notification === null || habit.notification === undefined) ? 0 : habit.notification;

        // Smart re-reminders: Fire at T (Due offset), T + 15m, and T + 45m
        const targetTimeHHMM = calculateTargetTime(habit.time, offset);
        const targetTimePlus15 = calculateTargetTime(habit.time, offset - 15);
        const targetTimePlus45 = calculateTargetTime(habit.time, offset - 45);

        // Check if any of these match the current localized minute
        const isDue = currentTimeHHMM === targetTimeHHMM;
        const isReRemind1 = currentTimeHHMM === targetTimePlus15;
        const isReRemind2 = currentTimeHHMM === targetTimePlus45;
        const isExactTimeMatch = offset !== 0 && habit.time === currentTimeHHMM;

        if (isDue || isReRemind1 || isReRemind2 || isExactTimeMatch) {
          try {
            const mappedCategory = mapCategoryToChannel(habit.category);
            const message: any = {
              notification: {
                title: isReRemind1 ? `Reminder: ${habit.name}` : isReRemind2 ? `Last Call: ${habit.name}` : 'HabytFlow Reminder',
                body: isReRemind1 || isReRemind2 ? `Protect your streak: Tap to mark this habit completed now.` : `Time for your habit: ${habit.name}!`,
              },
              token: user.fcmToken,
              android: {
                priority: 'high',
                notification: {
                  sound: 'default',
                  channelId: mappedCategory,
                  vibrateTimingsMillis: [0, 500, 500, 500],
                  defaultVibrateTimings: false,
                  defaultSound: true,
                  clickAction: 'HABIT_ACTIONS'
                }
              },
              apns: {
                payload: {
                  aps: {
                    sound: 'default',
                    category: 'HABIT_ACTIONS'
                  }
                }
              },
              webpush: {
                headers: {
                  Urgency: 'high'
                },
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
                    category: mappedCategory,
                    scheduledTime: habit.time,
                    actionUrl: '/'
                  }
                }
              }
            };

            await adminMessaging.send(message);
            notificationsSent++;
            console.log(`Successfully sent notification (Type: Due/Re-remind) for habit: ${habit.name} to user: ${user.userId} in timezone ${userTimezone}`);
            
            // Log telemetry event for delivery
            try {
              const deliveryEvent = new TelemetryEvent({
                eventType: 'notification_delivered',
                metadata: {
                  habitName: habit.name,
                  category: mappedCategory
                }
              });
              await deliveryEvent.save();
            } catch (telemetryErr) {
              console.error('Failed to log delivery telemetry:', telemetryErr);
            }
          } catch (error) {
            console.error(`Failed to send FCM to user ${user.userId}:`, error);
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      notificationsSent 
    });

  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
