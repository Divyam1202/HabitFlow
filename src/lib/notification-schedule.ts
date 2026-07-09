/**
 * Computes the next UTC instant a habit reminder should fire, given its
 * local (user-timezone) time-of-day and weekly frequency.
 *
 * This does NOT yet implement retry1/retry2/exact-offset logic from the
 * legacy cron (route.ts) — Phase 1 only needs the *initial* trigger time
 * to populate nextFireAt for shadow validation. Retry semantics move over
 * in Phase 2 when this function's output actually drives sends.
 */

export function computeNextFireAt(params: {
  time: string          // "HH:MM" local to timezone
  frequency: number[]   // days of week 0-6, 0=Sunday
  timezone: string
  from?: Date            // defaults to now; injectable for tests
}): Date | null {
  const { time, frequency, timezone, from = new Date() } = params;

  const parts = time?.split(':').map(Number);
  if (!parts || parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
    return null;
  }
  const [targetHour, targetMinute] = parts;

  if (!frequency || frequency.length === 0) {
    return null;
  }

  // Walk forward day by day (max 8 iterations covers today + full week)
  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const candidateUtc = new Date(from.getTime() + dayOffset * 86400000);

    // Get the candidate day's local Y-M-D in the target timezone, then
    // construct the intended local wall-clock time and convert back to UTC
    // by comparing formatted output — avoids manual offset math (DST-safe).
    const localDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(candidateUtc);
    const localDayOfWeek = new Date(
      new Date(candidateUtc.toLocaleString('en-US', { timeZone: timezone }))
    ).getDay();

    if (!frequency.includes(localDayOfWeek)) continue;

    // Construct target instant: interpret "localDateStr HH:MM" as being in
    // `timezone`, then find the UTC instant that formats to that in `timezone`.
    const naiveGuessUtc = new Date(`${localDateStr}T${String(targetHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')}:00Z`);

    // Correct for the timezone offset by comparing what naiveGuessUtc
    // actually renders as in `timezone` vs what we want, then shifting.
    const renderedInTz = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(naiveGuessUtc);
    const [renderedHour, renderedMinute] = renderedInTz.split(':').map(Number);

    const wantedMinutes = targetHour * 60 + targetMinute;
    const renderedMinutes = renderedHour * 60 + renderedMinute;
    const diffMinutes = wantedMinutes - renderedMinutes;

    const correctedUtc = new Date(naiveGuessUtc.getTime() + diffMinutes * 60000);

    if (correctedUtc.getTime() > from.getTime()) {
      return correctedUtc;
    }
    // If it's today but already passed, loop continues to next matching day.
  }

  return null; // no matching day found in the next 7 days (empty frequency edge case)
}