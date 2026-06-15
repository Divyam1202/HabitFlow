import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { connectToDatabase } from '@/lib/db';
import UserState from '@/models/UserState';
import PushSubscription from '@/models/PushSubscription';

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
          const matchesTime = habit.time === currentTimeHHMM;
          const matchesFrequency = !habit.frequency || habit.frequency.includes(currentDayOfWeek);
          return matchesTime && matchesFrequency;
        });

        if (triggeredHabits.length > 0) {
          for (const habit of triggeredHabits) {
            const payload = JSON.stringify({
              title: 'HabytFlow Reminder',
              body: `It's time for: ${habit.name} ${habit.category ? `(${habit.category})` : ''}`,
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
