import type { ActivityState, GridHabit, NutritionState } from '@/contexts/habit-context'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export type HabitPerformance = {
  id: number
  name: string
  executions: number
  scheduled: number
  completionRate: number
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
  baseDate = new Date()
): DailyHabitRecord[] {
  const today = startOfLocalDay(baseDate)
  const records: DailyHabitRecord[] = []
  const historicalDays = Math.max(0, heatmapData.length - 1)

  for (let i = 0; i < historicalDays; i++) {
    const daysAgo = historicalDays - i
    const date = new Date(today)
    date.setDate(today.getDate() - daysAgo)
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

function calculateHabitPerformance(gridData: GridHabit[], baseDate = new Date()): HabitPerformance[] {
  const today = startOfLocalDay(baseDate)

  return gridData.map((habit) => {
    let executions = 0
    let scheduled = 0

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
      completionRate: scheduled > 0 ? Math.round((executions / scheduled) * 100) : 0,
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

  const currentExecutions = records
    .filter((record) => record.date.getFullYear() === currentYear && record.date.getMonth() === currentMonth)
    .reduce((sum, record) => sum + record.completedCount, 0)

  const previousExecutions = records
    .filter((record) => record.date.getFullYear() === previous.getFullYear() && record.date.getMonth() === previous.getMonth())
    .reduce((sum, record) => sum + record.completedCount, 0)

  const percentChange = previousExecutions > 0
    ? Math.round(((currentExecutions - previousExecutions) / previousExecutions) * 100)
    : currentExecutions > 0 ? 100 : 0

  return { currentExecutions, previousExecutions, percentChange }
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
  baseDate = new Date()
): AnalyticsSummary {
  const dailyRecords = buildDailyRecords(gridData, heatmapData, baseDate)
  const last30Records = dailyRecords.slice(-30)
  const completedLast30 = last30Records.reduce((sum, record) => sum + record.completedCount, 0)
  const scheduledLast30 = last30Records.reduce((sum, record) => sum + record.scheduledCount, 0)
  const thirtyDayCompletionRate = scheduledLast30 > 0 ? Math.round((completedLast30 / scheduledLast30) * 100) : 0
  const habitPerformance = calculateHabitPerformance(gridData, baseDate)
  const currentStreak = calculateCurrentStreak(dailyRecords)
  const thirtyDayActiveDays = last30Records.filter((record) => record.completedCount > 0).length

  return {
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
