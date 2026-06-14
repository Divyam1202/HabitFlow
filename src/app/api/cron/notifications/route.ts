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
    // Get current time in HH:MM format using local system time of server/user or assume UTC.
    // Assuming the user's selected time maps to their local timezone, we would ideally store their timezone.
    // For this prototype, we'll use the server's UTC time and match against stored HH:MM 
    // (In production, user tzOffset must be factored in).
    
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeHHMM = `${hours}:${minutes}`;
    const currentDayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday

    const userStates = await UserState.find({});
    
    let notificationsSent = 0;

    for (const state of userStates) {
      if (!state.stateData) continue;
      
      const parsed = JSON.parse(state.stateData);
      const gridData = parsed.gridData || [];

      // Find habits that should trigger right now
      const triggeredHabits = gridData.filter((habit: any) => {
        const matchesTime = habit.time === currentTimeHHMM;
        const matchesFrequency = !habit.frequency || habit.frequency.includes(currentDayOfWeek);
        return matchesTime && matchesFrequency;
      });

      if (triggeredHabits.length > 0) {
        // Fetch push subscriptions for this user
        const subscriptions = await PushSubscription.find({ userId: state.userId });
        
        for (const subDoc of subscriptions) {
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
