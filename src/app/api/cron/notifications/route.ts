import { NextResponse } from 'next/server';
import { connectToDatabase as connectMongo } from '@/lib/db';
import UserState from '@/models/UserState';
import { adminMessaging } from '@/lib/firebase-admin';

// Helper to get current time in IST (HH:mm)
function getCurrentISTTimeHHMM(): string {
  const options: Intl.DateTimeFormatOptions = { 
    timeZone: 'Asia/Kolkata', 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: false 
  };
  return new Intl.DateTimeFormat('en-GB', options).format(new Date());
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
  // In a real production app, verify Vercel Cron Secret here:
  // const authHeader = request.headers.get('authorization');
  // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) { ... }

  try {
    await connectMongo();
    
    // Get all users who have registered an FCM token
    const users = await UserState.find({ fcmToken: { $exists: true, $ne: "" } });
    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, message: 'No users with FCM tokens found' });
    }

    const currentTimeHHMM = getCurrentISTTimeHHMM();
    console.log(`[Cron] Checking habits for time: ${currentTimeHHMM} IST`);

    let notificationsSent = 0;

    for (const user of users) {
      if (!user.stateData) continue;

      let habits = [];
      try {
        habits = JSON.parse(user.stateData);
      } catch (err) {
        console.error('Failed to parse stateData for user', user.userId);
        continue;
      }

      for (const habit of habits) {
        // Default to 0 offset (at time of event) if undefined or null
        const offset = (habit.notification === null || habit.notification === undefined) ? 0 : habit.notification;

        const targetTimeHHMM = calculateTargetTime(habit.time, offset);

        // If the calculated target time perfectly matches the current time
        if (targetTimeHHMM === currentTimeHHMM) {
          try {
            const message = {
              notification: {
                title: 'HabytFlow Reminder 🎯',
                body: `It's time for: ${habit.name}!`,
              },
              token: user.fcmToken,
            };

            await adminMessaging.send(message);
            notificationsSent++;
            console.log(`Successfully sent notification for habit: ${habit.name} to user: ${user.userId}`);
          } catch (error) {
            console.error(`Failed to send FCM to user ${user.userId}:`, error);
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      currentTime: currentTimeHHMM,
      notificationsSent 
    });

  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
