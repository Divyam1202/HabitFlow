import type { ActivityState, GridHabit, NutritionState } from '@/contexts/habit-context'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export type HabitPerformance = {
  id: number
  name: string
  executions: number
  scheduled: number
  completionRate: number
  trackingDays: number
  status: 'Never Completed' | 'Currently Missed' | 'Needs Attention' | 'On Track'
}

export type DailyHabitRecord = {
  date: Date
  key: string
  completedCount: number
  scheduledCount: number
  ratio: number | null
}

export type MonthlyComparison = {
  currentExecutions: number
  previousExecutions: number
  percentChange: number
  currentCompletionRate: number
  previousCompletionRate: number
  currentAveragePerTrackedDay: number
  previousAveragePerTrackedDay: number
  currentScheduledCompletionRate: number
  previousScheduledCompletionRate: number
  completionRateChange: number
  averagePerTrackedDayChange: number
}

export type AnalyticsSummary = {
  dailyRecords: DailyHabitRecord[]
  currentStreak: number
  longestStreak: number
  currentState: 'INITIATION' | 'MOMENTUM' | 'AUTOMATED' | 'MASTERED'
  lifetimeExecutions: number
  activeDays: number
  thirtyDayCompletionRate: number
  thirtyDayActiveDays: number
  topHabit: HabitPerformance | null
  weakestHabit: HabitPerformance | null
  longestLapse: number
  habitPerformance: HabitPerformance[]
  monthlyTrend: Array<{ month: string; rate: number; executions: number }>
  monthlyComparison: MonthlyComparison
  consistencyScore: number
}

function parseDateLike(value: string | Date | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : startOfLocalDay(date)
}

function getEarliestActivityDate(
  gridData: GridHabit[],
  heatmapData: Array<{ count: number }>,
  baseDate = new Date()
) {
  const today = startOfLocalDay(baseDate)
  const heatmapStart = new Date(today)
  heatmapStart.setDate(today.getDate() - Math.max(0, heatmapData.length - 1))

  for (let index = 0; index < heatmapData.length; index++) {
    const entry = heatmapData[index]
    if ((entry?.count || 0) <= 0) continue
    const date = new Date(heatmapStart)
    date.setDate(heatmapStart.getDate() + index)
    return date
  }

  for (const habit of gridData) {
    for (let index = 0; index < habit.days.length; index++) {
      if (!habit.days[index]?.completed) continue
      const date = new Date(today)
      date.setDate(today.getDate() - ((habit.days.length - 1) - index))
      return date
    }
  }

  return null
}

function resolveTrackingStartDate(
  gridData: GridHabit[],
  heatmapData: Array<{ count: number }>,
  trackingStartedAt: string | Date | null | undefined,
  baseDate = new Date()
) {
  const configuredStart = parseDateLike(trackingStartedAt)
  const firstActivity = getEarliestActivityDate(gridData, heatmapData, baseDate)

  if (configuredStart && firstActivity) {
    return configuredStart.getTime() > firstActivity.getTime() ? configuredStart : firstActivity
  }

  return configuredStart || firstActivity || startOfLocalDay(baseDate)
}

export function toDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

export function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function getDayDiff(targetDate: Date, baseDate = new Date()) {
  const target = startOfLocalDay(targetDate)
  const base = startOfLocalDay(baseDate)
  return Math.round((target.getTime() - base.getTime()) / MS_PER_DAY)
}

export function isHabitScheduledOnDate(habit: Pick<GridHabit, 'frequency'>, date: Date) {
  return !habit.frequency || habit.frequency.includes(date.getDay())
}

export function getGridDayStats(gridData: GridHabit[], date: Date, baseDate = new Date()): DailyHabitRecord {
  const diffDays = getDayDiff(date, baseDate)

  if (diffDays > 0 || diffDays < -29) {
    return {
      date: startOfLocalDay(date),
      key: toDateKey(date),
      completedCount: 0,
      scheduledCount: 0,
      ratio: null,
    }
  }

  let completedCount = 0
  let scheduledCount = 0

  for (const habit of gridData) {
    if (!isHabitScheduledOnDate(habit, date)) continue
    scheduledCount++

    const dayIndex = habit.days.length - 1 + diffDays
    if (habit.days[dayIndex]?.completed) completedCount++
  }

  return {
    date: startOfLocalDay(date),
    key: toDateKey(date),
    completedCount,
    scheduledCount,
    ratio: scheduledCount > 0 ? completedCount / scheduledCount : null,
  }
}

export function getGridDayRatio(gridData: GridHabit[], date: Date, baseDate = new Date()) {
  return getGridDayStats(gridData, date, baseDate).ratio
}

export function buildDailyRecords(
  gridData: GridHabit[],
  heatmapData: Array<{ count: number }>,
  trackingStartedAt: string | Date | null | undefined = null,
  baseDate = new Date()
): DailyHabitRecord[] {
  const today = startOfLocalDay(baseDate)
  const trackingStart = resolveTrackingStartDate(gridData, heatmapData, trackingStartedAt, baseDate)
  const records: DailyHabitRecord[] = []
  const historicalDays = Math.max(0, heatmapData.length - 1)

  for (let i = 0; i < historicalDays; i++) {
    const daysAgo = historicalDays - i
    const date = new Date(today)
    date.setDate(today.getDate() - daysAgo)
    if (date.getTime() < trackingStart.getTime()) continue
    const completedCount = heatmapData[i]?.count || 0

    records.push({
      date,
      key: toDateKey(date),
      completedCount,
      scheduledCount: gridData.length,
      ratio: gridData.length > 0 ? completedCount / gridData.length : null,
    })
  }

  for (let diffDays = -29; diffDays <= 0; diffDays++) {
    const date = new Date(today)
    date.setDate(today.getDate() + diffDays)
    if (date.getTime() < trackingStart.getTime()) continue
    const record = getGridDayStats(gridData, date, today)
    const existingIndex = records.findIndex((item) => item.key === record.key)

    if (existingIndex >= 0) records[existingIndex] = record
    else records.push(record)
  }

  return records.sort((a, b) => a.date.getTime() - b.date.getTime())
}

function calculateCurrentStreak(records: DailyHabitRecord[]) {
  let streak = 0

  for (let i = records.length - 1; i >= 0; i--) {
    const record = records[i]
    if (record.completedCount > 0) streak++
    else break
  }

  return streak
}

function calculateLongestStreak(records: DailyHabitRecord[]) {
  let longest = 0
  let current = 0

  for (const record of records) {
    if (record.completedCount > 0) {
      current++
      longest = Math.max(longest, current)
    } else {
      current = 0
    }
  }

  return longest
}

function calculateLongestLapse(records: DailyHabitRecord[]) {
  let longest = 0
  let current = 0

  for (const record of records) {
    if (record.completedCount === 0) {
      current++
      longest = Math.max(longest, current)
    } else {
      current = 0
    }
  }

  return longest
}

function getCurrentState(currentStreak: number): AnalyticsSummary['currentState'] {
  if (currentStreak >= 66) return 'MASTERED'
  if (currentStreak >= 21) return 'AUTOMATED'
  if (currentStreak >= 7) return 'MOMENTUM'
  return 'INITIATION'
}

function calculateHabitPerformance(
  gridData: GridHabit[],
  trackingStartedAt: string | Date | null | undefined,
  baseDate = new Date(),
  heatmapData: Array<{ count: number }> = []
): HabitPerformance[] {
  const today = startOfLocalDay(baseDate)
  const trackingStart = resolveTrackingStartDate(gridData, heatmapData, trackingStartedAt, baseDate)
  const trackingDays = Math.max(1, Math.floor((today.getTime() - trackingStart.getTime()) / MS_PER_DAY) + 1)

  return gridData.map((habit) => {
    let executions = 0
    let scheduled = 0
    const hasAnyCompletion = habit.days.some((day) => day.completed)

    for (let diffDays = -29; diffDays <= 0; diffDays++) {
      const date = new Date(today)
      date.setDate(today.getDate() + diffDays)
      if (!isHabitScheduledOnDate(habit, date)) continue

      scheduled++
      const dayIndex = habit.days.length - 1 + diffDays
      if (habit.days[dayIndex]?.completed) executions++
    }

    return {
      id: habit.id,
      name: habit.name,
      executions,
      scheduled,
      trackingDays,
      completionRate: scheduled > 0 ? Math.round((executions / scheduled) * 100) : 0,
      status: (executions === 0
        ? (hasAnyCompletion ? 'Currently Missed' : 'Never Completed')
        : executions < scheduled * 0.5
          ? 'Needs Attention'
          : 'On Track') as HabitPerformance['status'],
    }
  }).sort((a, b) => b.completionRate - a.completionRate || b.executions - a.executions || a.name.localeCompare(b.name))
}

function calculateMonthlyTrend(records: DailyHabitRecord[], baseDate = new Date()) {
  const months = Array.from({ length: 6 }).map((_, index) => {
    const date = new Date(baseDate.getFullYear(), baseDate.getMonth() - (5 - index), 1)
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      completed: 0,
      scheduled: 0,
      executions: 0,
    }
  })

  for (const record of records) {
    const key = `${record.date.getFullYear()}-${record.date.getMonth()}`
    const month = months.find((item) => item.key === key)
    if (!month) continue

    month.completed += record.completedCount
    month.scheduled += record.scheduledCount
    month.executions += record.completedCount
  }

  return months.map((month) => ({
    month: month.month,
    rate: month.scheduled > 0 ? Math.round((month.completed / month.scheduled) * 100) : 0,
    executions: month.executions,
  }))
}

function calculateMonthlyComparison(records: DailyHabitRecord[], baseDate = new Date()): MonthlyComparison {
  const currentMonth = baseDate.getMonth()
  const currentYear = baseDate.getFullYear()
  const previous = new Date(currentYear, currentMonth - 1, 1)

  const currentMonthRecords = records.filter((record) => record.date.getFullYear() === currentYear && record.date.getMonth() === currentMonth)
  const previousMonthRecords = records.filter((record) => record.date.getFullYear() === previous.getFullYear() && record.date.getMonth() === previous.getMonth())

  return getNormalizedMonthlyChange(currentMonthRecords, previousMonthRecords)
}

function calculateConsistencyScore(currentStreak: number, activeDays: number, completionRate: number) {
  const streakScore = Math.min(currentStreak, 30) / 30
  const activeDayScore = Math.min(activeDays, 30) / 30
  const completionScore = completionRate / 100

  return Math.round((streakScore * 30) + (activeDayScore * 30) + (completionScore * 40))
}

export function calculateAnalyticsSummary(
  gridData: GridHabit[],
  heatmapData: Array<{ count: number }>,
  trackingStartedAt: string | Date | null | undefined = null,
  baseDate = new Date()
): AnalyticsSummary {
  const dailyRecords = buildDailyRecords(gridData, heatmapData, trackingStartedAt, baseDate)
  const last30Records = dailyRecords.slice(-30)
  const completedLast30 = last30Records.reduce((sum, record) => sum + record.completedCount, 0)
  const scheduledLast30 = last30Records.reduce((sum, record) => sum + record.scheduledCount, 0)
  const thirtyDayCompletionRate = scheduledLast30 > 0 ? Math.round((completedLast30 / scheduledLast30) * 100) : 0
  const habitPerformance = calculateHabitPerformance(gridData, trackingStartedAt, baseDate, heatmapData)
  const currentStreak = calculateCurrentStreak(dailyRecords)
  const thirtyDayActiveDays = last30Records.filter((record) => record.completedCount > 0).length

  const summary = {
    dailyRecords,
    currentStreak,
    longestStreak: calculateLongestStreak(dailyRecords),
    currentState: getCurrentState(currentStreak),
    lifetimeExecutions: dailyRecords.reduce((sum, record) => sum + record.completedCount, 0),
    activeDays: dailyRecords.filter((record) => record.completedCount > 0).length,
    thirtyDayCompletionRate,
    thirtyDayActiveDays,
    topHabit: habitPerformance[0] || null,
    weakestHabit: [...habitPerformance].filter((habit) => habit.scheduled > 0).sort((a, b) => a.completionRate - b.completionRate || a.executions - b.executions)[0] || null,
    longestLapse: calculateLongestLapse(dailyRecords),
    habitPerformance,
    monthlyTrend: calculateMonthlyTrend(dailyRecords, baseDate),
    monthlyComparison: calculateMonthlyComparison(dailyRecords, baseDate),
    consistencyScore: calculateConsistencyScore(currentStreak, thirtyDayActiveDays, thirtyDayCompletionRate),
  }

  assertAnalyticsConsistency(summary, 'calculateAnalyticsSummary')
  return summary
}

export function getNutritionSummary(nutrition: NutritionState) {
  const items = [
    { label: 'Hydration', value: nutrition.hydration, unit: 'ml' },
    { label: 'Calories', value: nutrition.calories, unit: 'kcal' },
    { label: 'Protein', value: nutrition.protein, unit: 'g' },
    { label: 'Carbs', value: nutrition.carbs, unit: 'g' },
  ]

  return items
}

export function getSportsSummary(activity: ActivityState) {
  const totalSessions = activity.sportsLog.length
  const totalHours = activity.sportsLog.reduce((sum, sport) => sum + sport.duration, 0)
  const averageDuration = totalSessions > 0 ? totalHours / totalSessions : 0
  const counts = activity.sportsLog.reduce<Record<string, number>>((acc, sport) => {
    acc[sport.name] = (acc[sport.name] || 0) + 1
    return acc
  }, {})
  const mostPlayedSport = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || 'NONE'

  return {
    mostPlayedSport,
    totalSessions,
    totalHours,
    averageDuration,
  }
}

export function getAnalyticsCurrentState(summary: Pick<AnalyticsSummary, 'thirtyDayCompletionRate' | 'currentStreak'>) {
  if (summary.thirtyDayCompletionRate >= 85 && summary.currentStreak >= 14) {
    return { label: 'Momentum', tone: 'text-green-500' }
  }

  if (summary.thirtyDayCompletionRate >= 65 && summary.currentStreak >= 7) {
    return { label: 'Consistent', tone: 'text-emerald-500' }
  }

  if (summary.thirtyDayCompletionRate > 0 || summary.currentStreak > 0) {
    return { label: 'Recovering', tone: 'text-amber-500' }
  }

  return { label: 'At Risk', tone: 'text-red-500' }
}

export function buildAnalyticsInsights(
  summary: Pick<AnalyticsSummary, 'topHabit' | 'weakestHabit' | 'currentStreak' | 'longestStreak' | 'monthlyComparison' | 'longestLapse'>,
  nutritionSummary: Array<{ label: string; value: number; unit: string }>,
  sportsSummary: ReturnType<typeof getSportsSummary>
) {
  const insights: Array<{ title: string; body: string }> = []

  if (summary.topHabit) {
    insights.push({
      title: 'Strongest habit',
      body: `${summary.topHabit.name} is leading at ${summary.topHabit.completionRate}% completion over the last 30 days.`,
    })
  }

  if (summary.weakestHabit) {
    const weakHabit = summary.weakestHabit.completionRate === 0
      ? `${summary.weakestHabit.name} has not been completed yet.`
      : `${summary.weakestHabit.name} is the lowest at ${summary.weakestHabit.completionRate}%.`

    insights.push({
      title: 'Needs attention',
      body: `${weakHabit} A smaller target or a clearer time block could help it recover.`,
    })
  }

  if (summary.currentStreak > 0) {
    insights.push({
      title: 'Current momentum',
      body: `You have a ${summary.currentStreak}-day streak right now, with a best run of ${summary.longestStreak} days.`,
    })
  } else {
    insights.push({
      title: 'Restart point',
      body: 'Your current streak is at zero. Start with one habit today to rebuild momentum quickly.',
    })
  }

  if (summary.monthlyComparison.previousExecutions > 0 || summary.monthlyComparison.currentExecutions > 0) {
    const percent = summary.monthlyComparison.percentChange
    const signedPercent = percent > 0 ? `+${percent}%` : `${percent}%`
    insights.push({
      title: 'Month-over-month',
      body: `This month is ${signedPercent} compared with last month (${summary.monthlyComparison.currentExecutions} vs ${summary.monthlyComparison.previousExecutions}).`,
    })
  }

  if (summary.longestLapse >= 5) {
    insights.push({
      title: 'Long gap',
      body: `There was a ${summary.longestLapse}-day lapse in your habit history. Tightening one habit window can reduce that drop-off.`,
    })
  }

  if (sportsSummary.totalSessions === 0) {
    insights.push({
      title: 'Sports log',
      body: 'No sports sessions are logged yet. Once you add workouts, this section will start showing your most frequent activity.',
    })
  } else {
    insights.push({
      title: 'Activity volume',
      body: `You logged ${sportsSummary.totalSessions} sports sessions across ${sportsSummary.totalHours.toFixed(1)} hours.`,
    })
  }

  if (nutritionSummary.every((item) => item.value === 0)) {
    insights.push({
      title: 'Nutrition',
      body: 'Nutrition is still empty. Log hydration or meals to unlock intake trends here.',
    })
  }

  return insights.slice(0, 5)
}

function assertAnalyticsConsistency(
  summary: Pick<AnalyticsSummary, 'dailyRecords' | 'lifetimeExecutions' | 'habitPerformance' | 'topHabit' | 'weakestHabit' | 'thirtyDayActiveDays' | 'thirtyDayCompletionRate'>,
  scope: string
) {
  if (summary.dailyRecords.some((record) => record.completedCount > 0) && summary.lifetimeExecutions === 0) {
    throw new Error(`${scope}: lifetimeExecutions is 0 despite completed daily records`)
  }

  if (summary.thirtyDayActiveDays > 0 && summary.thirtyDayCompletionRate === 0) {
    throw new Error(`${scope}: thirtyDayCompletionRate is 0 despite active days being tracked`)
  }

  if (summary.habitPerformance.length > 0 && !summary.topHabit) {
    throw new Error(`${scope}: topHabit is missing even though habitPerformance exists`)
  }

  if (summary.topHabit && summary.weakestHabit && summary.topHabit.completionRate < summary.weakestHabit.completionRate) {
    throw new Error(`${scope}: topHabit completion rate is lower than weakestHabit completion rate`)
  }
}

export function getSystemStatus(summary: AnalyticsSummary) {
  const top = summary.topHabit?.name || 'no top habit yet'
  const weak = summary.weakestHabit?.name || 'no weak habit yet'

  if (summary.thirtyDayCompletionRate >= 85 && summary.longestLapse <= 1) {
    return `SYSTEM STABLE: ${summary.currentStreak}-DAY STREAK, ${summary.thirtyDayCompletionRate}% COMPLETION, LED BY ${top}. NO MATERIAL LAPSE DETECTED.`
  }

  if (summary.currentStreak === 0) {
    return `SYSTEM RESET REQUIRED: CURRENT STREAK IS 0, LONGEST LAPSE IS ${summary.longestLapse} DAYS, AND ${weak} NEEDS THE FIRST RECOVERY TICK.`
  }

  if (summary.longestLapse >= 5) {
    return `VARIANCE DETECTED: ${summary.longestLapse}-DAY LONGEST LAPSE IS DRAGGING CONSISTENCY. PROTECT ${weak} WHILE KEEPING ${top} ACTIVE.`
  }

  if (summary.thirtyDayCompletionRate < 50) {
    return `LOW THROUGHPUT: ${summary.thirtyDayCompletionRate}% COMPLETION OVER 30 DAYS. ${weak} IS THE PRIMARY BOTTLENECK; ${top} IS CARRYING OUTPUT.`
  }

  return `SYSTEM BUILDING: ${summary.currentStreak}-DAY STREAK WITH ${summary.thirtyDayCompletionRate}% COMPLETION. ${top} IS STRONGEST; TIGHTEN ${weak} NEXT.`
}

export type AnalyticsMonthOption = {
  key: string
  label: string
  hasData: boolean
}

export type HistoricalHabitRecord = {
  name?: string
  category?: string
  frequency?: number[]
  history?: Record<string, boolean> | Array<[string, boolean]>
}

export type HistoricalDailyMetricRecord = {
  date?: string
  hydration?: number
  calories?: number
  protein?: number
  carbs?: number
}

export type HistoricalSportLogRecord = {
  date?: string
  name?: string
  durationHours?: number
}

export type AnalyticsHistorySnapshot = {
  userState?: {
    trackingStartedAt?: string
    currentSystemDate?: string
    stateData?: Record<string, unknown>
  }
  relatedData?: {
    legacyHabits?: HistoricalHabitRecord[]
    dailyMetrics?: HistoricalDailyMetricRecord[]
    sportsLogs?: HistoricalSportLogRecord[]
  }
}

export type MonthlyAnalyticsView = {
  monthKey: string
  monthLabel: string
  availableMonths: AnalyticsMonthOption[]
  dailyRecords: DailyHabitRecord[]
  currentState: AnalyticsSummary['currentState']
  currentStreak: number
  longestStreak: number
  lifetimeExecutions: number
  activeDays: number
  thirtyDayCompletionRate: number
  thirtyDayActiveDays: number
  topHabit: HabitPerformance | null
  weakestHabit: HabitPerformance | null
  longestLapse: number
  habitPerformance: HabitPerformance[]
  monthlyTrend: Array<{ month: string; rate: number; executions: number }>
  monthlyComparison: MonthlyComparison
  consistencyScore: number
  nutritionSummary: Array<{ label: string; value: number; unit: string }>
  sportsSummary: ReturnType<typeof getSportsSummary>
  insights: Array<{ title: string; body: string }>
}

function parseDateString(value: string | Date | null | undefined) {
  if (!value) return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  }

  const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})/)
  if (dateOnly) {
    const [year, month, day] = dateOnly[1].split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function getDateKeyString(value: string | Date | null | undefined) {
  if (!value) return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return toDateKey(value)
  }

  const raw = value.trim()
  if (!raw) return null

  const dateOnly = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (dateOnly) return dateOnly[1]

  const parsed = parseDateString(raw)
  return parsed ? toDateKey(parsed) : null
}

function getMonthKeyFromDateKey(dateKey: string | null | undefined) {
  if (!dateKey) return null
  return dateKey.slice(0, 7)
}

function getHabitHistoryDateBounds(history: HistoricalHabitRecord['history']) {
  const keys = normalizeHistoryEntries(history)
    .map(([dateKey]) => getDateKeyString(dateKey))
    .filter((dateKey): dateKey is string => Boolean(dateKey))
    .sort()

  return {
    firstDateKey: keys[0] || null,
    lastDateKey: keys[keys.length - 1] || null,
  }
}

function isHabitActiveOnOrBeforeDate(
  habit: HistoricalHabitRecord,
  dateKey: string,
  trackingStartKey: string
) {
  const historyBounds = getHabitHistoryDateBounds(habit.history)
  const habitStartKey = historyBounds.firstDateKey || trackingStartKey

  return habitStartKey <= dateKey
}

function startOfMonthLocal(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonthLocal(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

export function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function parseMonthKey(key: string) {
  const [yearPart, monthPart] = key.split('-')
  const year = Number(yearPart)
  const month = Number(monthPart)

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null
  }

  return new Date(year, month - 1, 1)
}

function getMonthLabel(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function normalizeHistoryEntries(history: HistoricalHabitRecord['history']) {
  if (!history) return [] as Array<[string, boolean]>
  if (history instanceof Map) return Array.from(history.entries())
  if (Array.isArray(history)) return history
  return Object.entries(history)
}

function getSnapshotStateData(snapshot: AnalyticsHistorySnapshot) {
  return isObject(snapshot.userState?.stateData) ? snapshot.userState!.stateData as Record<string, unknown> : {}
}

function getHistoryCompletionCount(history: HistoricalHabitRecord['history']) {
  return normalizeHistoryEntries(history).reduce((count, [, completed]) => count + (completed ? 1 : 0), 0)
}

function getPeriodMetrics(records: DailyHabitRecord[]) {
  const completed = records.reduce((sum, record) => sum + record.completedCount, 0)
  const scheduled = records.reduce((sum, record) => sum + record.scheduledCount, 0)
  const trackedDays = records.length

  return {
    completed,
    scheduled,
    trackedDays,
    completionRate: scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0,
    averagePerTrackedDay: trackedDays > 0 ? completed / trackedDays : 0,
    scheduledCompletionRate: scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0,
  }
}

function getPercentChange(current: number, previous: number) {
  if (previous > 0) return Math.round(((current - previous) / previous) * 100)
  return current > 0 ? 100 : 0
}

function getNormalizedMonthlyChange(currentRecords: DailyHabitRecord[], previousRecords: DailyHabitRecord[]): MonthlyComparison {
  const current = getPeriodMetrics(currentRecords)
  const previous = getPeriodMetrics(previousRecords)
  const completionRateChange = getPercentChange(current.completionRate, previous.completionRate)
  const averagePerTrackedDayChange = getPercentChange(current.averagePerTrackedDay, previous.averagePerTrackedDay)
  const percentChange = Math.round((completionRateChange + averagePerTrackedDayChange) / 2)

  return {
    currentExecutions: current.completed,
    previousExecutions: previous.completed,
    percentChange,
    currentCompletionRate: current.completionRate,
    previousCompletionRate: previous.completionRate,
    currentAveragePerTrackedDay: current.averagePerTrackedDay,
    previousAveragePerTrackedDay: previous.averagePerTrackedDay,
    currentScheduledCompletionRate: current.scheduledCompletionRate,
    previousScheduledCompletionRate: previous.scheduledCompletionRate,
    completionRateChange,
    averagePerTrackedDayChange,
  }
}

function buildMonthRange(start: Date, end: Date) {
  const months: Date[] = []
  const current = startOfMonthLocal(start)
  const final = startOfMonthLocal(end)

  while (current.getTime() <= final.getTime()) {
    months.push(new Date(current))
    current.setMonth(current.getMonth() + 1)
  }

  return months
}

function buildHistoricalCompletionIndex(snapshot: AnalyticsHistorySnapshot) {
  const habits = snapshot.relatedData?.legacyHabits || []
  let earliestDate: Date | null = null
  let latestDate: Date | null = null

  for (const habit of habits) {
    for (const [dateKey] of normalizeHistoryEntries(habit.history)) {
      const normalizedKey = getDateKeyString(dateKey)
      if (!normalizedKey) continue
      const date = parseDateString(normalizedKey)
      if (!date) continue
      if (!earliestDate || date.getTime() < earliestDate.getTime()) earliestDate = date
      if (!latestDate || date.getTime() > latestDate.getTime()) latestDate = date
    }
  }

  const dailyMetrics = snapshot.relatedData?.dailyMetrics || []
  const sportsLogs = snapshot.relatedData?.sportsLogs || []

  for (const record of dailyMetrics) {
    const date = parseDateString(record.date)
    if (!date) continue
    if (!earliestDate || date.getTime() < earliestDate.getTime()) earliestDate = date
    if (!latestDate || date.getTime() > latestDate.getTime()) latestDate = date
  }

  for (const record of sportsLogs) {
    const date = parseDateString(record.date)
    if (!date) continue
    if (!earliestDate || date.getTime() < earliestDate.getTime()) earliestDate = date
    if (!latestDate || date.getTime() > latestDate.getTime()) latestDate = date
  }

  const trackingStart = earliestDate || startOfLocalDay(new Date())
  const rangeStart = trackingStart
  const rangeEnd = latestDate || startOfLocalDay(new Date())

  return {
    trackingStart,
    rangeStart,
    rangeEnd,
  }
}

function buildHabitPerformanceForRange(
  snapshot: AnalyticsHistorySnapshot,
  monthStart: Date,
  monthEnd: Date,
  trackingStart: Date
) {
  const habits = snapshot.relatedData?.legacyHabits || []

  return habits.map((habit, index) => {
    const habitName = typeof habit.name === 'string' && habit.name.trim() ? habit.name.trim() : 'Habit'
    const history = normalizeHistoryEntries(habit.history)
    const historyMap = new Map(
      history
        .map(([dateKey, completed]) => [getDateKeyString(dateKey), !!completed] as const)
        .filter((entry): entry is readonly [string, boolean] => Boolean(entry[0]))
    )
    const historyBounds = getHabitHistoryDateBounds(habit.history)
    const activeStartKey = historyBounds.firstDateKey || toDateKey(trackingStart)
    const completionCount = getHistoryCompletionCount(habit.history)
    let executions = 0
    let scheduled = 0
    let trackingDays = 0

    for (let cursor = new Date(monthStart); cursor.getTime() <= monthEnd.getTime(); cursor.setDate(cursor.getDate() + 1)) {
      const key = toDateKey(cursor)
      if (key < activeStartKey || key < toDateKey(trackingStart)) continue

      trackingDays++

      if (!isHabitScheduledOnDate({ frequency: habit.frequency }, cursor)) continue

      scheduled++
      if (historyMap.get(key)) executions++
    }

    const status: HabitPerformance['status'] = completionCount === 0
      ? 'Never Completed'
      : executions === 0
        ? 'Currently Missed'
        : executions < scheduled * 0.5
          ? 'Needs Attention'
          : 'On Track'

    return {
      id: resolveHabitId(habit, index),
      name: habitName,
      executions,
      scheduled,
      completionRate: scheduled > 0 ? Math.round((executions / scheduled) * 100) : 0,
      trackingDays: Math.max(1, trackingDays),
      status,
    }
  }).sort((a, b) => b.completionRate - a.completionRate || b.executions - a.executions || a.name.localeCompare(b.name))
}

function resolveHabitId(habit: HistoricalHabitRecord, index: number) {
  const rawId = (habit as { _id?: unknown })._id

  if (typeof rawId === 'number' && Number.isFinite(rawId)) {
    return rawId
  }

  if (typeof rawId === 'string') {
    const parsed = Number.parseInt(rawId.replace(/\D/g, ''), 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return index + 1
}

function getMonthlyLongestLapse(habitPerformance: HabitPerformance[], monthStart: Date, monthEnd: Date, snapshot: AnalyticsHistorySnapshot, trackingStart: Date) {
  const habits = snapshot.relatedData?.legacyHabits || []
  let longest = 0

  for (const habit of habits) {
    const history = normalizeHistoryEntries(habit.history)
    const completionCount = getHistoryCompletionCount(habit.history)
    if (completionCount === 0) continue
    const historyMap = new Map(
      history
        .map(([dateKey, completed]) => [getDateKeyString(dateKey), !!completed] as const)
        .filter((entry): entry is readonly [string, boolean] => Boolean(entry[0]))
    )
    const activeStartKey = getHabitHistoryDateBounds(habit.history).firstDateKey || toDateKey(trackingStart)
    let current = 0
    let hasCompletion = false

    for (let cursor = new Date(monthStart); cursor.getTime() <= monthEnd.getTime(); cursor.setDate(cursor.getDate() + 1)) {
      const key = toDateKey(cursor)
      if (key < activeStartKey || key < toDateKey(trackingStart)) continue
      const completed = historyMap.get(key) || false
      if (completed) {
        hasCompletion = true
        current = 0
      } else {
        current++
        longest = Math.max(longest, current)
      }
    }

    if (!hasCompletion) continue
  }

  return longest
}

function calculateDailyRecordsForMonth(snapshot: AnalyticsHistorySnapshot, monthStart: Date, monthEnd: Date, trackingStart: Date) {
  const habits = snapshot.relatedData?.legacyHabits || []
  const records: DailyHabitRecord[] = []
  const trackingStartKey = toDateKey(trackingStart)

  for (let cursor = new Date(monthStart); cursor.getTime() <= monthEnd.getTime(); cursor.setDate(cursor.getDate() + 1)) {
    const date = startOfLocalDay(cursor)
    const dateKey = toDateKey(date)
    if (dateKey < trackingStartKey) continue
    let completedCount = 0
    let scheduledCount = 0

    for (const habit of habits) {
      if (!isHabitActiveOnOrBeforeDate(habit, dateKey, trackingStartKey)) continue
      scheduledCount++
      const completed = normalizeHistoryEntries(habit.history).find(([storedDateKey]) => getDateKeyString(storedDateKey) === dateKey)?.[1] || false
      if (completed) completedCount++
    }

    records.push({
      date,
      key: dateKey,
      completedCount,
      scheduledCount,
      ratio: scheduledCount > 0 ? completedCount / scheduledCount : null,
    })
  }

  return records
}

function calculateMonthlyTrendFromSnapshot(snapshot: AnalyticsHistorySnapshot, monthStart: Date, monthEnd: Date, trackingStart: Date) {
  const dailyCounts = new Map<string, number>()
  const habits = snapshot.relatedData?.legacyHabits || []

  for (const habit of habits) {
    for (const [dateKey, completed] of normalizeHistoryEntries(habit.history)) {
      if (!completed) continue
      const normalizedKey = getDateKeyString(dateKey)
      if (!normalizedKey) continue
      dailyCounts.set(normalizedKey, (dailyCounts.get(normalizedKey) || 0) + 1)
    }
  }

  const months = buildMonthRange(new Date(monthStart.getFullYear(), monthStart.getMonth() - 5, 1), monthEnd)
  const trackingStartKey = toDateKey(trackingStart)

  return months.map((month) => {
    const start = startOfMonthLocal(month)
    const end = endOfMonthLocal(month)
    let completed = 0
    let scheduled = 0

    for (let cursor = new Date(start); cursor.getTime() <= end.getTime(); cursor.setDate(cursor.getDate() + 1)) {
      const key = toDateKey(cursor)
      if (key < trackingStartKey) continue
      completed += dailyCounts.get(key) || 0
      scheduled += habits.filter((habit) => {
        return isHabitActiveOnOrBeforeDate(habit, key, trackingStartKey)
      }).length
    }

    return {
      month: month.toLocaleDateString('en-US', { month: 'short' }),
      rate: scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0,
      executions: completed,
    }
  })
}

function summarizeMonthActivity(snapshot: AnalyticsHistorySnapshot, monthStart: Date) {
  const nutritionSummary = [
    { label: 'Hydration', value: 0, unit: 'ml' },
    { label: 'Calories', value: 0, unit: 'kcal' },
    { label: 'Protein', value: 0, unit: 'g' },
    { label: 'Carbs', value: 0, unit: 'g' },
  ]
  const monthKey = getMonthKey(monthStart)

  for (const record of snapshot.relatedData?.dailyMetrics || []) {
    const dateKey = getDateKeyString(record.date)
    if (!dateKey || getMonthKeyFromDateKey(dateKey) !== monthKey) continue
    nutritionSummary[0].value += Number(record.hydration || 0)
    nutritionSummary[1].value += Number(record.calories || 0)
    nutritionSummary[2].value += Number(record.protein || 0)
    nutritionSummary[3].value += Number(record.carbs || 0)
  }

  const stateData = getSnapshotStateData(snapshot)
  const stateDateKey = getDateKeyString(typeof stateData.currentSystemDate === 'string' ? stateData.currentSystemDate : null)
  const stateMonthKey = getMonthKeyFromDateKey(stateDateKey)
  const stateNutrition = isObject(stateData.todayNutrition) ? stateData.todayNutrition as Record<string, unknown> : null

  if (stateNutrition && stateDateKey && stateMonthKey === monthKey) {
    const nutritionAlreadyIncluded = snapshot.relatedData?.dailyMetrics?.some((record) => getDateKeyString(record.date) === stateDateKey)
    if (!nutritionAlreadyIncluded) {
      nutritionSummary[0].value += Number(stateNutrition.hydration || 0)
      nutritionSummary[1].value += Number(stateNutrition.calories || 0)
      nutritionSummary[2].value += Number(stateNutrition.protein || 0)
      nutritionSummary[3].value += Number(stateNutrition.carbs || 0)
    }
  }

  const sportsCounts = new Map<string, number>()
  let totalSessions = 0
  let totalHours = 0

  for (const record of snapshot.relatedData?.sportsLogs || []) {
    const dateKey = getDateKeyString(record.date)
    if (!dateKey || getMonthKeyFromDateKey(dateKey) !== monthKey) continue
    const name = typeof record.name === 'string' && record.name.trim() ? record.name.trim() : 'Activity'
    const duration = Number(record.durationHours || 0)
    totalSessions++
    totalHours += duration
    sportsCounts.set(name, (sportsCounts.get(name) || 0) + 1)
  }

  const stateActivity = isObject(stateData.todayActivity) ? stateData.todayActivity as Record<string, unknown> : null
  const stateSportsLogs = Array.isArray(stateActivity?.sportsLog) ? stateActivity.sportsLog as Record<string, unknown>[] : []
  if (stateSportsLogs.length > 0 && stateDateKey && stateMonthKey === monthKey) {
    const sportsAlreadyIncluded = snapshot.relatedData?.sportsLogs?.some((record) => getDateKeyString(record.date) === stateDateKey)
    if (!sportsAlreadyIncluded) {
      for (const entry of stateSportsLogs) {
        const name = typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : 'Activity'
        const duration = Number(typeof entry.durationHours === 'number' ? entry.durationHours : entry.duration || 0)
        totalSessions++
        totalHours += duration
        sportsCounts.set(name, (sportsCounts.get(name) || 0) + 1)
      }
    }
  }

  const mostPlayedSport = [...sportsCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || 'NONE'

  return {
    nutritionSummary,
    sportsSummary: {
      mostPlayedSport,
      totalSessions,
      totalHours,
      averageDuration: totalSessions > 0 ? totalHours / totalSessions : 0,
    },
  }
}

function buildInsightsForMonth(
  summary: Pick<MonthlyAnalyticsView, 'topHabit' | 'weakestHabit' | 'currentStreak' | 'longestStreak' | 'monthlyComparison' | 'longestLapse' | 'sportsSummary' | 'nutritionSummary'>
) {
  const insights: Array<{ title: string; body: string }> = []

  if (summary.topHabit) {
    insights.push({
      title: 'Strongest habit',
      body: `${summary.topHabit.name} leads this month at ${summary.topHabit.completionRate}% completion.`,
    })
  }

  if (summary.weakestHabit) {
    insights.push({
      title: 'Needs attention',
      body: summary.weakestHabit.completionRate === 0
        ? `${summary.weakestHabit.name} has never been completed yet.`
        : `${summary.weakestHabit.name} is trailing at ${summary.weakestHabit.completionRate}%.`,
    })
  }

  insights.push({
    title: 'Current momentum',
    body: summary.currentStreak > 0
      ? `You closed the selected month with a ${summary.currentStreak}-day streak.`
      : 'The selected month ended without an active streak.',
  })

  if (summary.monthlyComparison.previousExecutions > 0 || summary.monthlyComparison.currentExecutions > 0) {
    insights.push({
      title: 'Month-over-month',
      body: `Completion volume changed by ${summary.monthlyComparison.percentChange}% versus the previous month.`,
    })
  }

  if (summary.longestLapse >= 5) {
    insights.push({
      title: 'Long gap',
      body: `Your longest missed stretch this month was ${summary.longestLapse} days.`,
    })
  }

  if (summary.sportsSummary.totalSessions === 0) {
    insights.push({
      title: 'Sports log',
      body: 'No sports sessions were logged in the selected month.',
    })
  }

  if (summary.nutritionSummary.every((item) => item.value === 0)) {
    insights.push({
      title: 'Nutrition',
      body: 'No nutrition entries were logged in the selected month.',
    })
  }

  return insights.slice(0, 5)
}

export function buildAnalyticsMonthOptions(snapshot: AnalyticsHistorySnapshot, currentDate = new Date()): AnalyticsMonthOption[] {
  const { rangeStart, rangeEnd } = buildHistoricalCompletionIndex(snapshot)
  const months = buildMonthRange(rangeStart, rangeEnd)
  const monthSet = new Set<string>()

  for (const habit of snapshot.relatedData?.legacyHabits || []) {
    for (const [dateKey, completed] of normalizeHistoryEntries(habit.history)) {
      if (!completed) continue
      const normalizedKey = getDateKeyString(dateKey)
      if (normalizedKey) monthSet.add(getMonthKeyFromDateKey(normalizedKey)!)
    }
  }

  for (const record of snapshot.relatedData?.dailyMetrics || []) {
    const dateKey = getDateKeyString(record.date)
    const monthKey = getMonthKeyFromDateKey(dateKey)
    if (monthKey) monthSet.add(monthKey)
  }

  for (const record of snapshot.relatedData?.sportsLogs || []) {
    const dateKey = getDateKeyString(record.date)
    const monthKey = getMonthKeyFromDateKey(dateKey)
    if (monthKey) monthSet.add(monthKey)
  }

  monthSet.add(getMonthKey(startOfMonthLocal(currentDate)))

  return months.map((month) => {
    const key = getMonthKey(month)
    return {
      key,
      label: getMonthLabel(month),
      hasData: monthSet.has(key),
    }
  }).filter((month) => month.hasData)
}

export function calculateHistoricalAnalyticsView(
  snapshot: AnalyticsHistorySnapshot,
  selectedMonth: Date,
  currentDate = new Date()
): MonthlyAnalyticsView {
  const monthStart = startOfMonthLocal(selectedMonth)
  const monthEnd = endOfMonthLocal(selectedMonth)
  const { trackingStart } = buildHistoricalCompletionIndex(snapshot)
  const dailyRecords = calculateDailyRecordsForMonth(snapshot, monthStart, monthEnd, trackingStart)
  const previousMonthStart = new Date(monthStart)
  previousMonthStart.setMonth(previousMonthStart.getMonth() - 1)
  const previousMonthEnd = new Date(monthStart)
  previousMonthEnd.setDate(0)
  const previousMonthRecords = calculateDailyRecordsForMonth(snapshot, previousMonthStart, previousMonthEnd, trackingStart)
  const trailing30Start = new Date(monthEnd)
  trailing30Start.setDate(trailing30Start.getDate() - 29)
  const trailing30Records = dailyRecords.filter((record) => record.date.getTime() >= trailing30Start.getTime())

  const trailing30Metrics = getPeriodMetrics(trailing30Records)
  const thirtyDayCompletionRate = trailing30Metrics.completionRate
  const habitPerformance = buildHabitPerformanceForRange(snapshot, monthStart, monthEnd, trackingStart)
  const weeklyActiveDays = dailyRecords.filter((record) => record.completedCount > 0).length
  const monthlyComparison = getNormalizedMonthlyChange(dailyRecords, previousMonthRecords)
  const currentExecutions = monthlyComparison.currentExecutions
  const topHabit = habitPerformance[0] || null
  const weakestHabit = [...habitPerformance].filter((habit) => habit.scheduled > 0).sort((a, b) => a.completionRate - b.completionRate || a.executions - b.executions)[0] || null
  const longestLapse = getMonthlyLongestLapse(habitPerformance, monthStart, monthEnd, snapshot, trackingStart)
  const monthlyTrend = calculateMonthlyTrendFromSnapshot(snapshot, monthStart, monthEnd, trackingStart)
  const nutritionAndSports = summarizeMonthActivity(snapshot, monthStart)
  const currentStateValue = getCurrentState(weeklyActiveDays >= 14 ? 14 : weeklyActiveDays)

  const summaryForInsights: MonthlyAnalyticsView = {
    monthKey: getMonthKey(selectedMonth),
    monthLabel: getMonthLabel(selectedMonth),
    availableMonths: buildAnalyticsMonthOptions(snapshot, currentDate),
    dailyRecords,
    currentState: currentStateValue,
    currentStreak: calculateCurrentStreak(dailyRecords),
    longestStreak: calculateLongestStreak(dailyRecords),
    lifetimeExecutions: currentExecutions,
    activeDays: weeklyActiveDays,
    thirtyDayCompletionRate,
    thirtyDayActiveDays: trailing30Records.filter((record) => record.completedCount > 0).length,
    topHabit,
    weakestHabit,
    longestLapse,
    habitPerformance,
    monthlyTrend,
    monthlyComparison,
    consistencyScore: calculateConsistencyScore(calculateCurrentStreak(dailyRecords), weeklyActiveDays, thirtyDayCompletionRate),
    nutritionSummary: nutritionAndSports.nutritionSummary,
    sportsSummary: nutritionAndSports.sportsSummary,
    insights: [],
  }

  const result = {
    ...summaryForInsights,
    currentState: getCurrentState(summaryForInsights.currentStreak),
    insights: buildInsightsForMonth(summaryForInsights),
  }

  assertAnalyticsConsistency(result, 'calculateHistoricalAnalyticsView')
  return result
}
