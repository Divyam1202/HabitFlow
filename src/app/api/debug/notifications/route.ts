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

        const currentMinutes = timeToMinutes(currentTimeInTimezone);
        const habitMinutes = timeToMinutes(h.time);
        
        let isDue = false;
        let isExactMatch = false;
        let isReRemind1 = false;
        let isReRemind2 = false;

        let initialTarget = -1;
        let exactTarget = -1;
        let retry1Target = -1;
        let retry2Target = -1;

        if (currentMinutes !== -1 && habitMinutes !== -1) {
          const retryEnabled = h.notifPrefs?.retry !== false;

          // Target times in minutes
          const initialTargetRaw = habitMinutes - offset;
          const exactTargetRaw = offset > 0 ? habitMinutes : -1;
          const retry1TargetRaw = retryEnabled ? (habitMinutes - offset + 15) : -1;
          const retry2TargetRaw = retryEnabled ? (habitMinutes - offset + 45) : -1;

          // Normalized to [0, 1439]
          initialTarget = normalizeMinutes(initialTargetRaw);
          exactTarget = exactTargetRaw !== -1 ? normalizeMinutes(exactTargetRaw) : -1;
          retry1Target = retry1TargetRaw !== -1 ? normalizeMinutes(retry1TargetRaw) : -1;
          retry2Target = retry2TargetRaw !== -1 ? normalizeMinutes(retry2TargetRaw) : -1;

          // Resolve overlaps
          if (exactTarget === retry1Target) {
            exactTarget = -1;
          }
          if (exactTarget === retry2Target) {
            exactTarget = -1;
          }

          // Window matching (15 minutes window size)
          isDue = isTimeInWindow(currentMinutes, initialTarget, 15);
          isExactMatch = exactTarget !== -1 && isTimeInWindow(currentMinutes, exactTarget, 15);
          isReRemind1 = retry1Target !== -1 && isTimeInWindow(currentMinutes, retry1Target, 15);
          isReRemind2 = retry2Target !== -1 && isTimeInWindow(currentMinutes, retry2Target, 15);
        }

        return {
          id: h.id,
          name: h.name,
          category: h.category,
          time: h.time,
          offsetMinutes: offset,
          targetMinutes: initialTarget,
          exactMinutes: exactTarget,
          retry1Minutes: retry1Target,
          retry2Minutes: retry2Target,
          currentTimeInTimezone,
          isCompleted: todayHabits.includes(h.id),
          isScheduledToday,
          frequency: h.frequency || null,
          dayOfWeek,
          isDue,
          isReRemind1,
          isReRemind2,
          isExactMatch,
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
