import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import UserState from '@/models/UserState';

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

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await connectToDatabase();

    const now = new Date();
    // In a real app we might fetch user's timezone from their state or rely on OneSignal's timezone delivery.
    // For this cron, we assume the server time is aligned with the user, or we'll just use UTC.
    // Actually, OneSignal allows delivering at the user's timezone if we schedule it!
    // But since we are triggering instantly via cron, we need to know the user's time.
    // Assuming server time matches the user's intended time for now (or use UTC).
    
    // For exact match, let's just use the server's local time (or UTC depending on deployment)
    // To properly support timezones, the user state should ideally store the timezone.
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeHHMM = `${hours}:${minutes}`;
    const currentDayOfWeek = now.getDay();

    const userStates = await UserState.find({});
    let notificationsSent = 0;

    for (const state of userStates) {
      if (!state.stateData) continue;
      
      const parsed = JSON.parse(state.stateData);
      const gridData = parsed.gridData || [];

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

          // Send via OneSignal REST API targeting this specific user by external_id
          const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`
            },
            body: JSON.stringify({
              app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
              include_aliases: { external_id: [state.userId] },
              target_channel: "push",
              headings: { en: 'HabytFlow Reminder' },
              contents: { en: bodyText },
              url: 'https://habyt-flow.vercel.app/dashboard'
            })
          });

          if (response.ok) {
            notificationsSent++;
          } else {
            const err = await response.text();
            console.error('OneSignal Error:', err);
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
