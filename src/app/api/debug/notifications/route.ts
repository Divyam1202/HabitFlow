import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/lib/auth';
import UserState from '@/models/UserState';

export const dynamic = 'force-dynamic';

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
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date());
  }
}

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

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const users = await UserState.find({}).lean();
    
    const diagnostics = users.map(user => {
      let parsedState: any = {};
      try {
        if (user.stateData) {
          parsedState = JSON.parse(user.stateData);
        }
      } catch (e) {
        parsedState = { error: 'Failed to parse stateData' };
      }

      const timezone = user.timezone || 'Asia/Kolkata';
      const currentTimeInTimezone = getCurrentTimeInTimezone(timezone);
      const habits = parsedState.gridData || [];
      const todayHabits = parsedState.todayHabits || [];

      // Get current weekday in user's timezone
      const dateInUserTimezone = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
      const dayOfWeek = dateInUserTimezone.getDay();

      const evaluatedHabits = habits.map((h: any) => {
        let offset = 0;
        if (h.notification !== null && h.notification !== undefined) {
          const parsedOffset = parseInt(String(h.notification), 10);
          if (!isNaN(parsedOffset)) {
            offset = parsedOffset;
          }
        }

        const isScheduledToday = h.frequency ? h.frequency.includes(dayOfWeek) : true;
        const targetTimeHHMM = calculateTargetTime(h.time, offset);
        const targetTimePlus15 = calculateTargetTime(h.time, offset - 15);
        const targetTimePlus45 = calculateTargetTime(h.time, offset - 45);

        return {
          id: h.id,
          name: h.name,
          category: h.category,
          time: h.time,
          offsetMinutes: offset,
          targetTimeHHMM,
          targetTimePlus15,
          targetTimePlus45,
          currentTimeInTimezone,
          isCompleted: todayHabits.includes(h.id),
          isScheduledToday,
          frequency: h.frequency || null,
          dayOfWeek,
          isDue: timesMatch(currentTimeInTimezone, targetTimeHHMM),
          isReRemind1: timesMatch(currentTimeInTimezone, targetTimePlus15),
          isReRemind2: timesMatch(currentTimeInTimezone, targetTimePlus45),
          isExactMatch: offset !== 0 && timesMatch(h.time, currentTimeInTimezone),
        };
      });

      return {
        userId: user.userId,
        hasFcmToken: !!user.fcmToken,
        fcmTokenSnippet: user.fcmToken ? `${user.fcmToken.substring(0, 10)}...` : null,
        timezone,
        currentTimeInTimezone,
        habitsCount: habits.length,
        evaluatedHabits,
      };
    });

    return NextResponse.json({
      success: true,
      serverTimeUtc: new Date().toISOString(),
      diagnostics,
    });
  } catch (error: any) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
