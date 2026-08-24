import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import HabitSchedule from '@/models/HabitSchedule';
import ShadowSendLog from '@/models/ShadowSendLog';
import UserState from '@/models/UserState';
import { computeNextFireAt } from '@/lib/notification-schedule';
import { mapCategoryToChannel, buildNotificationCopy } from '@/lib/notification-copy';
import { isCanaryUser } from '@/lib/canary';
import { adminMessaging } from '@/lib/firebase-admin';

const BATCH_LIMIT = 500; // cap per tick so one slow run can't starve the next

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    console.error('[Cron v2] CRON_SECRET is not set. Refusing to run.');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();

  const now = new Date();
  const due = await HabitSchedule.find({
    active: true,
    nextFireAt: { $lte: now },
  })
    .limit(BATCH_LIMIT)
    .lean();

  let shadowCount = 0;
  let liveCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Cache UserState lookups per userId within this tick to avoid N+1 queries
  // when a user has multiple due habits in the same run.
  const userStateCache = new Map<string, any>();
  const getUserState = async (userId: string) => {
    if (userStateCache.has(userId)) return userStateCache.get(userId);
    const us = await UserState.findOne({ userId }).lean();
    userStateCache.set(userId, us);
    return us;
  };

  for (const schedule of due) {
    const evaluatedAt = new Date();
    const live = isCanaryUser(schedule.userId);
    const mode: 'shadow' | 'canary_live' = live ? 'canary_live' : 'shadow';

    try {
      const userState: any = await getUserState(schedule.userId);

      // Determine completion + push pref from the still-authoritative legacy blob.
      let isCompleted = false;
      let categoryDisabled = false;
      if (userState?.stateData) {
        try {
          const parsed = JSON.parse(userState.stateData);
          const todayHabits: any[] = parsed.todayHabits || [];
          isCompleted = todayHabits.includes(Number(schedule.habitId)) || todayHabits.includes(schedule.habitId);
          const channel = mapCategoryToChannel(schedule.category);
          categoryDisabled = parsed.categoryPrefs?.[channel]?.enabled === false;
        } catch {
          // legacy blob unparsable — treat as not-completed, not-disabled, log will show it went through
        }
      }

      let outcome: 'would_send' | 'sent' | 'skipped_completed' | 'skipped_pref' | 'error';

      if (isCompleted) {
        outcome = 'skipped_completed';
        skippedCount++;
      } else if (categoryDisabled || !schedule.pushEnabled) {
        outcome = 'skipped_pref';
        skippedCount++;
      } else if (!live) {
        outcome = 'would_send';
        shadowCount++;
      } else if (!userState?.fcmToken) {
        outcome = 'skipped_pref'; // no token to send to
        skippedCount++;
      } else {
        const copy = buildNotificationCopy(schedule.name, schedule.category);
        const channel = mapCategoryToChannel(schedule.category);
        await adminMessaging.send({
          data: {
            title: copy.title,
            body: copy.body,
            habitId: String(schedule.habitId),
            habitName: schedule.name,
            category: channel,
            actionUrl: '/',
          },
          token: userState.fcmToken,
          android: {
            priority: 'high',
            notification: { sound: 'default', channelId: channel },
          },
          webpush: {
            headers: { Urgency: 'high' },
          },
          apns: { payload: { aps: { sound: 'default' } } },
        });
        outcome = 'sent';
        liveCount++;
      }

      await ShadowSendLog.create({
        userId: schedule.userId,
        habitId: schedule.habitId,
        habitName: schedule.name,
        scheduledFor: schedule.nextFireAt,
        evaluatedAt,
        mode,
        outcome,
      });
    } catch (err: any) {
      errorCount++;
      await ShadowSendLog.create({
        userId: schedule.userId,
        habitId: schedule.habitId,
        habitName: schedule.name,
        scheduledFor: schedule.nextFireAt,
        evaluatedAt,
        mode,
        outcome: 'error',
        errorMessage: err?.message || String(err),
      });
    }

    // Advance nextFireAt regardless of outcome so the schedule keeps ticking
    // forward — a skip (completed/pref-disabled) still consumes today's slot.
    const nextFireAt = computeNextFireAt({
      time: schedule.time,
      frequency: schedule.frequency,
      timezone: schedule.timezone,
      from: now,
    });
    await HabitSchedule.updateOne(
      { _id: schedule._id },
      { $set: { nextFireAt, lastFiredAt: now, lastFiredKind: 'initial' } }
    );
  }

  return NextResponse.json({
    success: true,
    evaluated: due.length,
    shadowCount,
    liveCount,
    skippedCount,
    errorCount,
    canaryPercent: process.env.CANARY_PERCENT || '0',
  });
}
