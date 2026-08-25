'use client'

import React, { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { Bar, BarChart, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { useRouter } from 'next/navigation'
import { Activity, CalendarDays, ChevronLeft, Dumbbell, Sparkles, Trophy, TrendingUp, UtensilsCrossed, X } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import {
  buildAnalyticsMonthOptions,
  calculateHistoricalAnalyticsView,
  getAnalyticsCurrentState,
  getMonthKey,
  parseMonthKey,
  type AnalyticsMonthOption,
  type MonthlyAnalyticsView,
} from '@/utils/analytics'
import { useAnalyticsSnapshot } from '@/hooks/useAnalyticsSnapshot'

const DynamicResponsiveContainer = dynamic(
  () => import('recharts').then((mod) => mod.ResponsiveContainer),
  { ssr: false }
)

type MetricCardProps = {
  label: string
  value: React.ReactNode
  meta: string
  tone?: string
  valueClassName?: string
}

function formatDayLabel(value: number) {
  return `${value} Day${value === 1 ? '' : 's'}`
}

function formatTrackingDaysLabel(value: number) {
  return `${value} Tracking Day${value === 1 ? '' : 's'}`
}

function formatSignedPercent(value: number) {
  if (value > 0) return `+${value}%`
  if (value < 0) return `${value}%`
  return '0%'
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function getValueTypography(value: React.ReactNode, variant: 'default' | 'compact' = 'default') {
  const raw = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
  const length = raw.length

  if (variant === 'compact') {
    if (length <= 8) return 'whitespace-nowrap text-[clamp(0.95rem,1.6vw,1.45rem)]'
    if (length <= 14) return 'whitespace-nowrap text-[clamp(0.9rem,1.35vw,1.15rem)]'
    return 'whitespace-normal text-[clamp(0.85rem,1.1vw,1rem)] leading-tight'
  }

  if (length <= 4) return 'whitespace-nowrap text-[clamp(1.35rem,3vw,3rem)]'
  if (length <= 8) return 'whitespace-nowrap text-[clamp(1.15rem,2.4vw,2.5rem)]'
  if (length <= 14) return 'whitespace-nowrap text-[clamp(1rem,2vw,1.9rem)]'
  return 'whitespace-normal text-[clamp(0.95rem,1.7vw,1.35rem)] leading-tight'
}

function MetricCard({ label, value, meta, tone = 'text-foreground', valueClassName = '' }: MetricCardProps) {
  const rawValue = typeof value === 'string' || typeof value === 'number' ? String(value) : ''
  const valueTypography = getValueTypography(rawValue)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      whileHover={{ y: -2 }}
      className="min-w-0 border border-border bg-card p-4 text-card-foreground rounded-[1px] shadow-none transition-colors duration-200 hover:border-white/30"
    >
      <div className="flex min-h-32 min-w-0 flex-col items-center justify-center gap-3 text-center">
        <div className="min-w-0 space-y-1">
          <div className="text-[clamp(0.65rem,0.9vw,0.75rem)] font-bold uppercase tracking-widest text-zinc-400/90">
            {label}
          </div>
          <div className={`min-w-0 ${valueTypography} font-black uppercase tracking-wider ${tone} ${valueClassName}`}>
            {value}
          </div>
        </div>
        <div className="min-w-0 whitespace-normal wrap-break-word text-[clamp(0.6rem,0.78vw,0.7rem)] font-bold uppercase tracking-widest text-zinc-400/85">
          {meta}
        </div>
      </div>
    </motion.div>
  )
}

function SectionHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h2 className="text-[clamp(1rem,1.8vw,1.125rem)] font-bold uppercase tracking-widest text-foreground">
        {title}
      </h2>
      {meta ? (
        <div className="text-[clamp(0.62rem,0.85vw,0.72rem)] font-bold uppercase tracking-widest text-zinc-400/85">
          {meta}
        </div>
      ) : null}
    </div>
  )
}

function EmptyPanel({ icon: Icon, title, body }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; body: string }) {
  return (
    <div className="flex min-h-37 flex-col items-start justify-between gap-4 border border-border p-4">
      <div className="flex items-start gap-3">
        <div className="border border-border bg-background p-2">
          <Icon size={16} className="text-zinc-500" />
        </div>
        <div className="min-w-0">
          <div className="text-[clamp(0.85rem,1.1vw,1rem)] font-bold uppercase tracking-widest text-foreground">
            {title}
          </div>
          <p className="mt-2 text-[clamp(0.72rem,0.9vw,0.8rem)] leading-relaxed text-zinc-400/90">{body}</p>
        </div>
      </div>
    </div>
  )
}

function MonthSelectorModal({
  isOpen,
  isLoading,
  months,
  selectedMonthKey,
  currentMonthKey,
  onSelectMonth,
  onBackToCurrentMonth,
  onClose,
}: {
  isOpen: boolean
  isLoading: boolean
  months: AnalyticsMonthOption[]
  selectedMonthKey: string
  currentMonthKey: string
  onSelectMonth: (key: string) => void
  onBackToCurrentMonth: () => void
  onClose: () => void
}) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-lg border border-border bg-card p-5 text-card-foreground shadow-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[clamp(0.75rem,0.95vw,0.85rem)] font-bold uppercase tracking-widest text-foreground">
              Previous Months
            </div>
            <p className="mt-1 text-[clamp(0.72rem,0.9vw,0.8rem)] leading-relaxed text-zinc-400/90">
              Choose a month to reload the dashboard with that period’s tracked history.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-border bg-background p-2 text-zinc-400/90 transition-colors hover:border-white/30 hover:text-foreground"
            aria-label="Close month selector"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="border border-border p-4 text-[clamp(0.72rem,0.9vw,0.8rem)] font-bold uppercase tracking-widest text-zinc-400/90">
              Loading tracked months...
            </div>
          ) : months.length === 0 ? (
            <div className="border border-border p-4 text-[clamp(0.72rem,0.9vw,0.8rem)] font-bold uppercase tracking-widest text-zinc-400/90">
              No previous months with tracked data yet.
            </div>
          ) : (
            months.map((month) => {
              const isSelected = month.key === selectedMonthKey

              return (
                <button
                  key={month.key}
                  type="button"
                  onClick={() => onSelectMonth(month.key)}
                  className={`flex w-full items-center justify-between gap-4 border p-4 text-left transition-colors ${
                    isSelected
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-background text-foreground hover:border-white/30'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[clamp(0.8rem,1vw,0.95rem)] font-bold uppercase tracking-widest">
                      {month.label}
                    </div>
                    <div className={`mt-1 text-[clamp(0.62rem,0.8vw,0.72rem)] font-bold uppercase tracking-widest ${isSelected ? 'text-background/80' : 'text-zinc-400/90'}`}>
                      {month.key === currentMonthKey ? 'Current month' : 'Tracked data available'}
                    </div>
                  </div>
                  {isSelected ? (
                    <div className="text-[clamp(0.62rem,0.8vw,0.72rem)] font-bold uppercase tracking-widest">
                      Selected
                    </div>
                  ) : null}
                </button>
              )
            })
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={onBackToCurrentMonth}
            className="inline-flex items-center gap-2 border border-border bg-background px-3 py-2 text-[clamp(0.68rem,0.8vw,0.75rem)] font-bold uppercase tracking-widest text-foreground transition-colors hover:border-white/30"
            disabled={selectedMonthKey === currentMonthKey}
          >
            <ChevronLeft size={14} />
            Back to Current Month
          </button>
          <button
            type="button"
            onClick={onClose}
            className="border border-border bg-background px-3 py-2 text-[clamp(0.68rem,0.8vw,0.75rem)] font-bold uppercase tracking-widest text-zinc-400/90 transition-colors hover:border-white/30 hover:text-foreground"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function AnalyticsPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const { snapshot: historySnapshot, loading: historyLoading, error: historyError } = useAnalyticsSnapshot()
  const router = useRouter()
  const currentMonthKey = getMonthKey(new Date())
  const [selectedMonthKey, setSelectedMonthKey] = useState(currentMonthKey)
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, isLoading, router])

  useEffect(() => {
    if (!monthPickerOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMonthPickerOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [monthPickerOpen])

  const historicalMonthOptions = useMemo(
    () => (historySnapshot ? buildAnalyticsMonthOptions(historySnapshot).filter((month) => month.key !== currentMonthKey) : []),
    [historySnapshot, currentMonthKey]
  )
  const selectedMonthIsAvailable = selectedMonthKey === currentMonthKey
    || historicalMonthOptions.some((month) => month.key === selectedMonthKey)
  const effectiveSelectedMonthKey = selectedMonthIsAvailable ? selectedMonthKey : currentMonthKey
  const selectedMonthDate = useMemo(() => parseMonthKey(effectiveSelectedMonthKey) ?? new Date(), [effectiveSelectedMonthKey])
  const historicalView = useMemo(() => {
    if (!historySnapshot || effectiveSelectedMonthKey === currentMonthKey) return null
    return calculateHistoricalAnalyticsView(historySnapshot, selectedMonthDate)
  }, [currentMonthKey, effectiveSelectedMonthKey, historySnapshot, selectedMonthDate])
  const currentMonthView = useMemo(() => {
    if (!historySnapshot) return null
    return calculateHistoricalAnalyticsView(historySnapshot, new Date())
  }, [historySnapshot])
  const summary = useMemo<MonthlyAnalyticsView | null>(() => {
    if (historicalView) {
      return historicalView
    }

    if (currentMonthView) {
      return currentMonthView
    }

    return null
  }, [currentMonthView, historicalView])
  const currentState = useMemo(() => (summary ? getAnalyticsCurrentState(summary) : { label: 'Loading', tone: 'text-zinc-500' }), [summary])
  const hasNutritionData = summary ? summary.nutritionSummary.some((item) => item.value > 0) : false
  const hasSportsData = summary ? summary.sportsSummary.totalSessions > 0 : false
  const selectedMonthLabel = effectiveSelectedMonthKey === currentMonthKey ? 'Current Month' : summary?.monthLabel ?? 'Current Month'
  const canReturnToCurrentMonth = effectiveSelectedMonthKey !== currentMonthKey

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <div className="animate-pulse text-sm font-bold uppercase tracking-widest text-zinc-500">
          Authenticating...
        </div>
      </div>
    )
  }

  if (historyError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-foreground">
        <div className="max-w-lg space-y-3 border border-border bg-card p-6">
          <div className="text-sm font-bold uppercase tracking-widest text-red-500">Analytics snapshot unavailable</div>
          <p className="text-sm text-zinc-400">{historyError}</p>
        </div>
      </div>
    )
  }

  if (historyLoading || !historySnapshot || !summary) {
    return (
      <div className="flex min-h-100 items-center justify-center">
        <div className="animate-pulse text-sm font-bold uppercase tracking-widest text-zinc-500">
          Loading analytics snapshot...
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 pb-24 pt-12 text-foreground">
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[clamp(1.35rem,2.6vw,2rem)] font-bold uppercase tracking-widest text-foreground leading-none">
            Productivity Dashboard
          </h1>
          <p className="mt-1.5 text-[clamp(0.8rem,1vw,0.95rem)] font-medium text-zinc-400/90">
            A live view of your habits, activity, nutrition, and momentum.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <div className="flex flex-wrap justify-end gap-2">
            {canReturnToCurrentMonth ? (
              <button
                type="button"
                onClick={() => setSelectedMonthKey(currentMonthKey)}
                className="inline-flex items-center gap-2 border border-border bg-background px-3 py-2 text-[clamp(0.68rem,0.8vw,0.75rem)] font-bold uppercase tracking-widest text-foreground transition-colors hover:border-white/30"
              >
                <ChevronLeft size={14} />
                Back to Current Month
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setMonthPickerOpen(true)}
              className="inline-flex items-center gap-2 border border-border bg-background px-3 py-2 text-[clamp(0.68rem,0.8vw,0.75rem)] font-bold uppercase tracking-widest text-foreground transition-colors hover:border-white/30"
            >
              <CalendarDays size={14} />
              View Previous Months
            </button>
          </div>
          <div className="text-[clamp(0.68rem,0.8vw,0.75rem)] font-black uppercase tracking-widest text-zinc-400/85">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
          <div className="text-[clamp(0.62rem,0.8vw,0.72rem)] font-bold uppercase tracking-widest text-zinc-500/90">
            {selectedMonthLabel}
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <SectionHeader title="Overview" meta={`${summary.dailyRecords.length} tracked days`} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Current State"
            value={currentState.label}
            meta="Live status"
            tone={currentState.tone}
            valueClassName={getValueTypography(currentState.label)}
          />
          <MetricCard
            label="Active Streak"
            value={formatCount(summary.currentStreak)}
            meta={summary.currentStreak === 1 ? 'Consecutive Day' : 'Consecutive Days'}
          />
          <MetricCard
            label="Best Streak"
            value={formatCount(summary.longestStreak)}
            meta="Longest run in your history"
          />
          <MetricCard
            label="Lifetime Completions"
            value={formatCount(summary.lifetimeExecutions)}
            meta="All recorded completions"
          />
          <MetricCard
            label="30-Day Completion Rate"
            value={`${summary.thirtyDayCompletionRate}%`}
            meta={`${summary.thirtyDayActiveDays} active days in the last 30`}
            tone={summary.thirtyDayCompletionRate >= 70 ? 'text-green-500' : summary.thirtyDayCompletionRate >= 40 ? 'text-amber-500' : 'text-red-500'}
          />
        </div>
      </section>

      <section className="space-y-4 border-t border-border pt-6">
        <SectionHeader title="Personal Insights" meta="Live from your history" />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <MetricCard
                label="Top Habit"
                value={summary.topHabit ? (summary.topHabit.completionRate === 0 ? 'Never Completed' : summary.topHabit.name) : 'None yet'}
                meta={summary.topHabit ? `${summary.topHabit.status} • ${summary.topHabit.completionRate}% completion • ${formatTrackingDaysLabel(summary.topHabit.trackingDays)}` : 'No completed habit history'}
                tone="text-foreground"
                valueClassName={summary.topHabit?.status === 'Never Completed' ? getValueTypography('Never Completed') : ''}
              />
              <MetricCard
                label="Needs Attention"
                value={summary.weakestHabit ? summary.weakestHabit.name : 'None yet'}
                meta={summary.weakestHabit ? `${summary.weakestHabit.status} • ${summary.weakestHabit.completionRate}% completion • ${formatTrackingDaysLabel(summary.weakestHabit.trackingDays)}` : 'No habit performance to review'}
                tone={summary.weakestHabit && summary.weakestHabit.status === 'Never Completed' ? 'text-red-500' : summary.weakestHabit && summary.weakestHabit.status === 'Currently Missed' ? 'text-amber-500' : 'text-foreground'}
                valueClassName={summary.weakestHabit?.status === 'Never Completed' ? getValueTypography('Never Completed') : ''}
              />
              <MetricCard
                label="Longest Missed Habit"
                value={summary.longestLapse > 0 ? formatDayLabel(summary.longestLapse) : 'No gaps'}
                meta="Longest period without a completion"
                tone={summary.longestLapse >= 5 ? 'text-amber-500' : 'text-foreground'}
              />
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="lg:col-span-2 border border-border bg-card p-4 text-card-foreground rounded-[1px]"
          >
            <div className="flex items-center gap-2">
              <div className="text-[clamp(0.62rem,0.85vw,0.72rem)] font-bold uppercase tracking-widest text-zinc-400/85">Personal Insights</div>
              <Sparkles size={12} className="text-zinc-500" />
            </div>
            <div className="mt-4 space-y-3">
              {summary.insights.map((insight) => (
                <div key={`${insight.title}-${insight.body}`} className="border border-border p-3">
                  <div className="text-[clamp(0.62rem,0.85vw,0.72rem)] font-bold uppercase tracking-widest text-zinc-400/85">
                    {insight.title}
                  </div>
                  <p className="mt-2 text-[clamp(0.78rem,0.95vw,0.92rem)] leading-relaxed text-foreground">{insight.body}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="space-y-4 border-t border-border pt-6">
        <SectionHeader title="Nutrition & Activity" meta="Today’s logged totals" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="min-w-0 rounded-[1px] border border-border bg-card p-4 text-card-foreground lg:col-span-2"
          >
            <div className="mb-4 flex items-center gap-2">
              <UtensilsCrossed size={14} className="text-zinc-500" />
              <h3 className="text-[clamp(0.62rem,0.85vw,0.72rem)] font-bold uppercase tracking-widest text-zinc-400/85">Nutrition Totals</h3>
            </div>
            {hasNutritionData ? (
              <div className="grid grid-cols-2 gap-4">
                {summary.nutritionSummary.map((item) => (
                  <MetricCard
                    key={item.label}
                    label={item.label}
                    value={formatCount(item.value)}
                    meta={`Total ${item.unit}`}
                  />
                ))}
              </div>
            ) : (
              <EmptyPanel
                icon={UtensilsCrossed}
                title="No nutrition logged yet"
                body="Add hydration, calories, protein, or carbs to see your intake totals and trends here."
              />
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.04 }}
            className="min-w-0 rounded-[1px] border border-border bg-card p-4 text-card-foreground"
          >
            <div className="mb-4 flex items-center gap-2">
              <Dumbbell size={14} className="text-zinc-500" />
              <h3 className="text-[clamp(0.62rem,0.85vw,0.72rem)] font-bold uppercase tracking-widest text-zinc-400/85">Sports Summary</h3>
            </div>
            {hasSportsData ? (
              <div className="grid grid-cols-2 gap-4">
                <MetricCard label="Favourite Sport" value={summary.sportsSummary.mostPlayedSport} meta="Most frequently logged" valueClassName={getValueTypography(summary.sportsSummary.mostPlayedSport, 'compact')} />
                <MetricCard label="Sessions" value={formatCount(summary.sportsSummary.totalSessions)} meta="All recorded sessions" />
                <MetricCard label="Hours" value={summary.sportsSummary.totalHours.toFixed(1)} meta="Total training time" />
                <MetricCard label="Average" value={summary.sportsSummary.averageDuration.toFixed(1)} meta="Hours per session" />
              </div>
            ) : (
              <EmptyPanel
                icon={Activity}
                title="No sports sessions yet"
                body="Once you log workouts, this section will show your favourite sport, total sessions, and time spent training."
              />
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.08 }}
            className="min-w-0 rounded-[1px] border border-border bg-card p-4 text-card-foreground"
          >
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp size={14} className="text-zinc-500" />
              <h3 className="text-[clamp(0.62rem,0.85vw,0.72rem)] font-bold uppercase tracking-widest text-zinc-400/85">Consistency</h3>
            </div>
            <div className="space-y-4">
              <MetricCard
                label="Monthly Change"
                value={formatSignedPercent(summary.monthlyComparison.percentChange)}
                meta={`Completion ${summary.monthlyComparison.currentCompletionRate}% vs ${summary.monthlyComparison.previousCompletionRate}%; Avg ${summary.monthlyComparison.currentAveragePerTrackedDay.toFixed(1)} vs ${summary.monthlyComparison.previousAveragePerTrackedDay.toFixed(1)} completions per tracked day`}
                tone={summary.monthlyComparison.percentChange >= 0 ? 'text-green-500' : 'text-red-500'}
              />
              <MetricCard
                label="Consistency Score"
                value={summary.consistencyScore}
                meta="Blends streaks, active days, and completion rate"
              />
            </div>
          </motion.div>
        </div>
      </section>

      <section className="space-y-6 border-t border-border pt-6">
        <SectionHeader title="Trends" meta="Recent movement across your habits" />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="min-w-0 rounded-[1px] border border-border bg-card p-5 text-card-foreground"
          >
            <div className="mb-5 flex items-center gap-2">
              <TrendingUp size={14} className="text-zinc-500" />
              <h3 className="text-[clamp(0.62rem,0.85vw,0.72rem)] font-bold uppercase tracking-widest text-zinc-400/85">6-Month Progress</h3>
            </div>
            <div className="h-44 w-full overflow-hidden">
              <DynamicResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <LineChart data={summary.monthlyTrend} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={32}
                    tick={{ fontSize: 10, fill: '#71717a' }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#71717a' }}
                    tickMargin={10}
                  />
                  <Tooltip
                    cursor={{ stroke: 'var(--border)' }}
                    contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 0 }}
                    itemStyle={{ color: 'var(--foreground)' }}
                  />
                  <Line type="monotone" dataKey="rate" stroke="var(--foreground)" strokeWidth={2} dot={false} />
                </LineChart>
              </DynamicResponsiveContainer>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.04 }}
            className="min-w-0 rounded-[1px] border border-border bg-card p-5 text-card-foreground"
          >
            <div className="mb-5 flex items-center gap-2">
              <Activity size={14} className="text-zinc-500" />
              <h3 className="text-[clamp(0.62rem,0.85vw,0.72rem)] font-bold uppercase tracking-widest text-zinc-400/85">Monthly Volume</h3>
            </div>
            <div className="h-44 w-full overflow-hidden">
              <DynamicResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={summary.monthlyTrend} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                  <YAxis axisLine={false} tickLine={false} width={32} tick={{ fontSize: 10, fill: '#71717a' }} />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: '#71717a' }}
                    tickMargin={10}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--muted)' }}
                    contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 0 }}
                    itemStyle={{ color: 'var(--foreground)' }}
                  />
                  <Bar dataKey="executions" fill="var(--foreground)" radius={0} />
                </BarChart>
              </DynamicResponsiveContainer>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.08 }}
            className="min-w-0 rounded-[1px] border border-border bg-card p-5 text-card-foreground"
          >
            <div className="mb-5 flex items-center gap-2">
              <Trophy size={14} className="text-zinc-500" />
              <h3 className="text-[clamp(0.62rem,0.85vw,0.72rem)] font-bold uppercase tracking-widest text-zinc-400/85">Habit Ranking</h3>
            </div>

            <div className="space-y-3">
              {summary.habitPerformance.length === 0 ? (
                <EmptyPanel
                  icon={Trophy}
                  title="No habit performance yet"
                  body="Add habits and complete a few sessions to see the ranking update here."
                />
              ) : (
                summary.habitPerformance.slice(0, 6).map((habit) => (
                  <div key={habit.id} className="flex items-start justify-between gap-3 border border-border p-3">
                    <div className="min-w-0">
                      <div className="text-[clamp(0.82rem,1vw,0.95rem)] font-bold uppercase tracking-tight text-foreground">
                        {habit.name}
                      </div>
                      <div className="mt-1 text-[clamp(0.62rem,0.78vw,0.7rem)] font-bold uppercase tracking-widest text-zinc-400/85">
                        {habit.executions} / {habit.scheduled} scheduled
                      </div>
                    </div>
                    <div className="shrink-0 text-[clamp(0.78rem,1vw,0.95rem)] font-black uppercase tracking-widest text-foreground">
                      {habit.completionRate}%
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      </section>

      <MonthSelectorModal
        isOpen={monthPickerOpen}
        isLoading={historyLoading}
        months={historicalMonthOptions}
        selectedMonthKey={selectedMonthKey}
        currentMonthKey={currentMonthKey}
        onSelectMonth={(key) => {
          setSelectedMonthKey(key)
          setMonthPickerOpen(false)
        }}
        onBackToCurrentMonth={() => {
          setSelectedMonthKey(currentMonthKey)
          setMonthPickerOpen(false)
        }}
        onClose={() => setMonthPickerOpen(false)}
      />
    </div>
  )
}
