import HabitSchedule from '@/models/HabitSchedule'
import { computeNextFireAt } from '@/lib/notification-schedule'

/**
 * Phase 1 shadow write. Parses the legacy stateData blob and upserts a
 * HabitSchedule doc per habit. Never throws — a failure here must not
 * affect the legacy save, which remains the single source of truth
 * until Phase 3+ cutover.
 *
 * Deliberately synchronous with the request (awaited, not fire-and-forget)
 * so shadow-validation queries run against fresh data. Revisit if this
 * measurably slows down /api/user-state POST latency once user count grows;
 * at that point move to a queued/background write instead of removing it.
 */
export async function dualWriteHabitSchedules(
  userId: string,
  stateDataRaw: string,
  timezone: string
): Promise<void> {
  try {
    const parsed = JSON.parse(stateDataRaw)
    const habits: any[] = parsed?.gridData || []
    const seenHabitIds = new Set<string>()

    for (const habit of habits) {
      if (!habit?.id || !habit?.time) continue
      const habitId = String(habit.id)
      seenHabitIds.add(habitId)

      let offset = 0
      if (habit.notification !== null && habit.notification !== undefined) {
        const parsedOffset = parseInt(String(habit.notification), 10)
        if (!Number.isNaN(parsedOffset)) offset = parsedOffset
      }

      const frequency: number[] = Array.isArray(habit.frequency)
        ? habit.frequency
        : [0, 1, 2, 3, 4, 5, 6]

      const nextFireAt = computeNextFireAt({
        time: habit.time,
        frequency,
        timezone: timezone || 'Asia/Kolkata',
      })

      await HabitSchedule.findOneAndUpdate(
        { userId, habitId },
        {
          $set: {
            name: habit.name || 'Untitled Habit',
            category: habit.category || 'growth',
            time: habit.time,
            frequency,
            timezone: timezone || 'Asia/Kolkata',
            offsetMinutes: offset,
            retryEnabled: habit.notifPrefs?.retry !== false,
            pushEnabled: habit.notifPrefs?.push !== false,
            nextFireAt,
            active: true,
          },
        },
        { upsert: true }
      )
    }

    // Mark schedules for habits no longer present in the blob as inactive
    // rather than deleting — preserves history for the Phase-2 diff audit.
    const existing = await HabitSchedule.find({ userId }, 'habitId').lean()
    const staleIds = existing
      .map((d: any) => d.habitId)
      .filter((id: string) => !seenHabitIds.has(id))

    if (staleIds.length > 0) {
      await HabitSchedule.updateMany(
        { userId, habitId: { $in: staleIds } },
        { $set: { active: false, nextFireAt: null } }
      )
    }
  } catch (err) {
    console.error('[dualWriteHabitSchedules] non-fatal shadow-write error for user', userId, err)
  }
}