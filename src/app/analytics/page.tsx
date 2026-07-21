'use client'

import React, { useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Bar, BarChart, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useHabitContext } from '@/contexts/habit-context'
import {
  calculateAnalyticsSummary,
  getNutritionSummary,
  getSportsSummary,
  getSystemStatus,
} from '@/utils/analytics'

const DynamicResponsiveContainer = dynamic(
  () => import('recharts').then((mod) => mod.ResponsiveContainer),
  { ssr: false }
)

function CompactStat({
  label,
  value,
  meta,
  tone = 'text-foreground',
}: {
  label: string
  value: React.ReactNode
  meta: string
  tone?: string
}) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{label}</div>
      <div className={`text-2xl md:text-3xl font-black uppercase tracking-wider ${tone}`}>{value}</div>
      <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{meta}</div>
    </div>
  )
}

export default function AnalyticsPage() {
  const { gridData, heatmapData, todayNutrition, todayActivity } = useHabitContext()
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, isLoading, router])

  const summary = useMemo(
    () => calculateAnalyticsSummary(gridData, heatmapData),
    [gridData, heatmapData]
  )
  const nutritionSummary = useMemo(() => getNutritionSummary(todayNutrition), [todayNutrition])
  const sportsSummary = useMemo(() => getSportsSummary(todayActivity), [todayActivity])
  const systemStatus = useMemo(() => getSystemStatus(summary), [summary])

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <div className="text-sm font-bold uppercase tracking-widest text-zinc-500 animate-pulse">
          Authenticating...
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-100 mx-auto px-6 pt-12 pb-24 space-y-10 text-foreground">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-foreground">Productivity Dashboard</h1>
          <p className="text-zinc-500 mt-1.5 text-sm font-medium">Deep dive into your consistency metrics.</p>
        </div>
        <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500 font-mono">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-6 py-2">
        <CompactStat label="Current State" value={summary.currentState} meta={`${summary.currentStreak} day streak`} tone="text-green-500" />
        <CompactStat label="Active Streak" value={summary.currentStreak} meta="Days" />
        <CompactStat label="Best Streak" value={summary.longestStreak} meta="Longest Run" />
        <CompactStat label="Lifetime Volume" value={summary.lifetimeExecutions} meta="Executions" />
        <CompactStat label="30-Day Rate" value={`${summary.thirtyDayCompletionRate}%`} meta={`${summary.thirtyDayActiveDays} / 30 Days Logged`} />
      </div>

      <div className="space-y-6 pt-6 border-t border-border">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold uppercase tracking-widest text-foreground">System Diagnostics</h2>
          <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 border border-border bg-background px-3 py-1">
            Live State
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 space-y-4">
            <div className="grid grid-cols-3 gap-4 divide-x divide-border">
              <div className="space-y-1">
                <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Top Habit</div>
                <div className="text-sm md:text-base font-bold text-foreground uppercase mt-1">
                  {summary.topHabit ? `${summary.topHabit.name} (${summary.topHabit.completionRate}%)` : 'N/A'}
                </div>
              </div>
              <div className="pl-4 space-y-1">
                <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Weakest Habit</div>
                <div className="text-sm md:text-base font-bold text-red-500 uppercase mt-1">
                  {summary.weakestHabit ? `${summary.weakestHabit.name} (${summary.weakestHabit.completionRate}%)` : 'N/A'}
                </div>
              </div>
              <div className="pl-4 space-y-1">
                <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Longest Lapse</div>
                <div className="text-sm md:text-base font-bold text-foreground uppercase mt-1">{summary.longestLapse} Days</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-3 lg:border-l lg:border-border lg:pl-8">
            <div className="flex items-center gap-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono">System Status</div>
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            </div>
            <p className="text-xs text-zinc-555 leading-relaxed font-mono uppercase tracking-wide">
              {systemStatus}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 pt-6 border-t border-border">
        <div className="border border-border bg-card p-4 rounded-[1px] text-card-foreground lg:col-span-2">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4">Nutrition Totals</h3>
          <div className="grid grid-cols-2 gap-4">
            {nutritionSummary.map((item) => (
              <CompactStat
                key={item.label}
                label={item.label}
                value={item.value}
                meta={`Total ${item.unit}`}
              />
            ))}
          </div>
        </div>

        <div className="border border-border bg-card p-4 rounded-[1px] text-card-foreground">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4">Sports Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            <CompactStat label="Most Played" value={sportsSummary.mostPlayedSport} meta="Sport" />
            <CompactStat label="Sessions" value={sportsSummary.totalSessions} meta="Total" />
            <CompactStat label="Hours" value={sportsSummary.totalHours.toFixed(1)} meta="Total" />
            <CompactStat label="Average" value={sportsSummary.averageDuration.toFixed(1)} meta="Hours" />
          </div>
        </div>

        <div className="border border-border bg-card p-4 rounded-[1px] text-card-foreground">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4">Analytics V2</h3>
          <div className="space-y-5">
            <CompactStat
              label="Monthly Change"
              value={`${summary.monthlyComparison.percentChange >= 0 ? '+' : ''}${summary.monthlyComparison.percentChange}%`}
              meta={`${summary.monthlyComparison.currentExecutions} vs ${summary.monthlyComparison.previousExecutions}`}
              tone={summary.monthlyComparison.percentChange >= 0 ? 'text-green-500' : 'text-red-500'}
            />
            <CompactStat
              label="Consistency Score"
              value={summary.consistencyScore}
              meta="Streak + active days + rate"
            />
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-border w-full space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="border border-border bg-card p-6 rounded-[1px] text-card-foreground">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-6">6-Month Trajectory</h3>
            <div className="h-44 w-full -ml-4">
              <DynamicResponsiveContainer width="100%" height="100%">
                <LineChart data={summary.monthlyTrend}>
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} tickFormatter={v => `${v}%`} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} dy={10} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }} itemStyle={{ color: 'var(--foreground)' }} />
                  <Line type="stepAfter" dataKey="rate" stroke="var(--foreground)" strokeWidth={2} dot={false} />
                </LineChart>
              </DynamicResponsiveContainer>
            </div>
          </div>

          <div className="border border-border bg-card p-6 rounded-[1px] text-card-foreground">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-6">Monthly Volume</h3>
            <div className="h-44 w-full -ml-4">
              <DynamicResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.monthlyTrend}>
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} dy={10} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '0px' }} itemStyle={{ color: 'var(--foreground)' }} cursor={{ fill: 'var(--muted)' }} />
                  <Bar dataKey="executions" fill="var(--foreground)" radius={0} />
                </BarChart>
              </DynamicResponsiveContainer>
            </div>
          </div>

          <div className="border border-border bg-card p-6 rounded-[1px] text-card-foreground">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-6">Habit Performance</h3>
            <div className="space-y-4">
              {summary.habitPerformance.length === 0 && (
                <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">No habit data available</div>
              )}
              {summary.habitPerformance.slice(0, 6).map((habit) => (
                <CompactStat
                  key={habit.id}
                  label={habit.name}
                  value={habit.completionRate}
                  meta={`${habit.executions} executions`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
