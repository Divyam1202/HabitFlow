import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { connectToDatabase } from '@/lib/db';
import UserState from '@/models/UserState';
import PushSubscription from '@/models/PushSubscription';

function getOffsetMinutes(notificationStr: string | undefined): number {
  if (!notificationStr || notificationStr === 'None') return 0;
  if (notificationStr === '5 mins') return 5;
  if (notificationStr === '15 mins') return 15;
  if (notificationStr === '30 mins') return 30;
  if (notificationStr === '1 hr') return 60;
  return 0;
}

function getReminderTimeHHMM(timeStr: string, offsetMins: number): string | null {
  if (offsetMins === 0) return null;
  const [h, m] = timeStr.split(':').map(Number);
  let totalMins = h * 60 + m - offsetMins;
  if (totalMins < 0) totalMins += 24 * 60; // Handle midnight wrap-around
  const newH = Math.floor(totalMins / 60);
  const newM = totalMins % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

// Vercel Cron will hit this endpoint automatically
export const dynamic = 'force-dynamic';

if (process.env.VAPID_SUBJECT && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function GET(req: Request) {
  // Optional: Verify the request is coming from Vercel Cron
  // const authHeader = req.headers.get('authorization');
  // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  try {
    await connectToDatabase();

    const now = new Date();
    const userStates = await UserState.find({});
    const subscriptions = await PushSubscription.find({});
    
    let notificationsSent = 0;

    for (const state of userStates) {
      if (!state.stateData) continue;
      
      const parsed = JSON.parse(state.stateData);
      const gridData = parsed.gridData || [];

      // Find subscriptions for this user
      const userSubs = subscriptions.filter(sub => sub.userId === state.userId);
      if (userSubs.length === 0) continue;

      for (const subDoc of userSubs) {
        // Calculate the current time in the user's timezone
        const tz = subDoc.timezone || 'UTC';
        let userNow;
        try {
          const tzDateStr = new Date().toLocaleString("en-US", {timeZone: tz});
          userNow = new Date(tzDateStr);
        } catch (e) {
          userNow = now; // Fallback
        }

        const hours = String(userNow.getHours()).padStart(2, '0');
        const minutes = String(userNow.getMinutes()).padStart(2, '0');
        const currentTimeHHMM = `${hours}:${minutes}`;
        const currentDayOfWeek = userNow.getDay(); // 0 = Sunday, 6 = Saturday

        // Find habits that should trigger right now
        const triggeredHabits = gridData.filter((habit: any) => {
          if (!habit.time) return false;
          
          let matchesTime = habit.time === currentTimeHHMM;
          let isReminder = false;
          
          const offsetMins = getOffsetMinutes(habit.notification);
          if (offsetMins > 0) {
             const reminderTime = getReminderTimeHHMM(habit.time, offsetMins);
             if (reminderTime === currentTimeHHMM) {
               matchesTime = true;
               isReminder = true;
             }
          }
          
          if (matchesTime) {
             habit._isReminder = isReminder;
          }

          const matchesFrequency = !habit.frequency || habit.frequency.includes(currentDayOfWeek);
          return matchesTime && matchesFrequency;
        });

        if (triggeredHabits.length > 0) {
          for (const habit of triggeredHabits) {
            const bodyText = habit._isReminder 
              ? `Upcoming in ${habit.notification}: ${habit.name} ${habit.category ? `(${habit.category})` : ''}`
              : `It's time for: ${habit.name} ${habit.category ? `(${habit.category})` : ''}`;

            const payload = JSON.stringify({
              title: 'HabytFlow Reminder',
              body: bodyText,
              url: '/dashboard'
            });

            try {
              await webpush.sendNotification(subDoc.subscription, payload);
              notificationsSent++;
            } catch (error: any) {
              console.error('Web push failed:', error);
              // If subscription is invalid/gone (HTTP 410), delete it
              if (error.statusCode === 410 || error.statusCode === 404) {
                await PushSubscription.findByIdAndDelete(subDoc._id);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, sent: notificationsSent });
  } catch (error) {
    console.error('Error in cron job:', error);
    return NextResponse.json({ error: 'Failed to run notifications cron' }, { status: 500 });
  }
}
