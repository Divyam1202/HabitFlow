'use client'

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { LineChart, Line, BarChart, Bar, YAxis, XAxis, Tooltip, PieChart, Pie, Cell } from 'recharts'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'

const DynamicResponsiveContainer = dynamic(
  () => import('recharts').then((mod) => mod.ResponsiveContainer),
  { ssr: false }
)
import { useHabitContext } from '@/contexts/habit-context'
import { Flame, Check, Rocket } from 'lucide-react'

// --- Components ---
function AnimatedNumber({ value, start }: { value: number, start: boolean }) {
  const [displayValue, setDisplayValue] = React.useState(0)

  React.useEffect(() => {
    if (!start) return
    let startTimestamp: number | null = null
    const duration = 2000 // 2 seconds
    let frameId: number
    const animate = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(Math.floor(easeOut * value))
      if (progress < 1) frameId = requestAnimationFrame(animate)
    }
    frameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameId)
  }, [value, start])

  return <>{displayValue}</>
}

const MOCK_MONTHLY_DATA = [
  { month: 'Jan', rate: 45 },
  { month: 'Feb', rate: 52 },
  { month: 'Mar', rate: 68 },
  { month: 'Apr', rate: 74 },
  { month: 'May', rate: 82 },
  { month: 'Jun', rate: 85 }
]

const FAKE_REPORTS = [
  {
    id: 'jun-2026',
    date: 'June 2026',
    completionRate: 94,
    activeDays: 28,
    bestHabit: 'Reading (100%)',
    worstHabit: 'No Spend (60%)',
    longestLapse: '2 Days',
    highestFrictionDay: 'Sunday',
    systemDecay: '12%',
    insights: 'System operating at 94% efficiency. Gym pipeline output increased by 15% vs May baseline. Week 3 variance detected (3-day lapse); recovery protocol initiated successfully. No critical interventions required.'
  },
  {
    id: 'may-2026',
    date: 'May 2026',
    completionRate: 85,
    activeDays: 26,
    bestHabit: 'Meditation (90%)',
    worstHabit: 'Gym (50%)',
    longestLapse: '4 Days',
    highestFrictionDay: 'Wednesday',
    systemDecay: '22%',
    insights: 'System operating at 85% efficiency. Meditation pipeline output optimized. Gym variance detected in first half of month; calibration completed in Week 4.'
  }
]

const COLORS = ['#22c55e', '#3b82f6', '#a855f7', '#f97316', '#2DD4BF', '#fb293c'];

export default function AnalyticsPage() {
  const [selectedReport, setSelectedReport] = useState(FAKE_REPORTS[0].id)
  const { gridData, todayActivity, heatmapData } = useHabitContext()
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm font-bold uppercase tracking-widest text-zinc-500 animate-pulse">
          Authenticating...
        </div>
      </div>
    )
  }

  // --- Metrics Calculations ---
  const monthlyTotalCompletedDays = gridData.reduce((acc, habit) => acc + habit.days.filter(d => d.completed).length, 0);

  let totalScheduledDays = 0;
  gridData.forEach(habit => {
    habit.days.forEach(d => {
      const dateForDay = new Date();
      dateForDay.setDate(dateForDay.getDate() - (30 - d.day));
      if (!habit.frequency || habit.frequency.includes(dateForDay.getDay())) {
        totalScheduledDays++;
      }
    });
  });

  const activeDaysArray = Array.from({ length: 30 }).map((_, i) => {
    return gridData.some(habit => habit.days[i]?.completed);
  });
  const monthlyTotalActiveDays = activeDaysArray.filter(Boolean).length;

  const allTimeTotalTicks = heatmapData.reduce((acc, day) => acc + day.count, 0)
  const allTimeActiveDays = heatmapData.filter(day => day.count > 0).length

  let currentStreak = 0;
  let allTimeMaxStreak = 0;
  for (const day of heatmapData) {
    if (day.count > 0) {
      currentStreak++;
      if (currentStreak > allTimeMaxStreak) allTimeMaxStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }

  // Calculate current operating state based on current streak
  let currentOperatingState = 'INITIATION';
  if (currentStreak > 21) {
    currentOperatingState = 'AUTOMATED';
  } else if (currentStreak > 0) {
    currentOperatingState = 'MOMENTUM';
  }

  const pieDataRaw = gridData.reduce((acc, h) => {
    const completedCount = h.days.filter(d => d.completed).length;
    const existing = acc.find(a => a.name === h.category);
    if (existing) existing.value += completedCount;
    else acc.push({ name: h.category, value: completedCount });
    return acc;
  }, [] as { name: string, value: number }[]);

  if (todayActivity.sportsLog.length > 0) {
    pieDataRaw.push({ name: 'Sports', value: todayActivity.sportsLog.length });
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 pt-12 pb-24 space-y-12 text-foreground">

      {/* Productivity Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-foreground">Productivity Dashboard</h1>
          <p className="text-zinc-500 mt-1.5 text-sm font-medium">Deep dive into your consistency metrics.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500 font-mono">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })}
          </div>
          <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-zinc-500">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
          </div>
        </div>
      </div>

      {/* Metrics Row (No borders or boxes) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-4">
        {/* CURRENT STATE */}
        <div className="space-y-1">
          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Current State</div>
          <div className="text-2xl md:text-3xl font-black text-green-500 uppercase tracking-wider">{currentOperatingState}</div>
          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Day 24</div>
        </div>
        {/* ACTIVE STREAK */}
        <div className="space-y-1">
          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Active Streak</div>
          <div className="text-3xl md:text-4xl font-black text-foreground">{currentStreak}</div>
          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Days</div>
        </div>
        {/* LIFETIME VOLUME */}
        <div className="space-y-1">
          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Lifetime Volume</div>
          <div className="text-3xl md:text-4xl font-black text-foreground">{allTimeTotalTicks}</div>
          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Executions</div>
        </div>
        {/* 30-DAY RATE */}
        <div className="space-y-1">
          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">30-Day Rate</div>
          <div className="text-3xl md:text-4xl font-black text-foreground">
            {Math.round((monthlyTotalCompletedDays / (totalScheduledDays || 1)) * 100)}%
          </div>
          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
            {monthlyTotalActiveDays} / 30 Days Logged
          </div>
        </div>
      </div>

      {/* System Diagnostics Section */}
      <div className="space-y-6 pt-8 border-t border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold uppercase tracking-widest text-foreground">System Diagnostics Section</h2>
          {/* Archives Selector aligned cleanly on the right */}
          <div className="flex flex-col gap-1 w-28 shrink-0">
            <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-555 py-0.5 border border-border bg-background text-center w-full">Archives</div>
            <select
              value={selectedReport}
              onChange={(e) => setSelectedReport(e.target.value)}
              className="text-[9px] font-bold uppercase tracking-widest bg-background border border-border text-zinc-500 hover:text-foreground hover:border-foreground py-0.5 px-1 outline-none cursor-pointer rounded-[2px] transition-all duration-150 font-mono w-full text-center"
            >
              {(() => {
                const options = []
                const start = new Date(2026, 5, 1) // June 2026
                for (let i = 0; i < 12; i++) {
                  const optDate = new Date(start.getFullYear(), start.getMonth() + i, 1)
                  const val = optDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toLowerCase().replace(' ', '-')
                  const label = optDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                  options.push(
                    <option key={val} value={val} className="bg-background text-foreground">
                      {label}
                    </option>
                  )
                }
                return options
              })()}
            </select>
          </div>
        </div>

        {(() => {
          const activeReport = FAKE_REPORTS.find(r => r.id === selectedReport) || (() => {
            const parts = selectedReport.split('-');
            const m = parts[0] ? (parts[0].charAt(0).toUpperCase() + parts[0].slice(1)) : 'June';
            const y = parts[1] || '2026';
            return {
              id: selectedReport,
              date: `${m} ${y}`,
              completionRate: 0,
              activeDays: 0,
              bestHabit: 'N/A',
              worstHabit: 'N/A',
              longestLapse: 'N/A',
              highestFrictionDay: 'N/A',
              systemDecay: '0%',
              insights: `System analytics initialized for ${m} ${y}. No tracking data exists for this future time window.`
            };
          })();

          return (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* Left Column: Diagnostics Statistics */}
              <div className="lg:col-span-3 space-y-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  {activeReport.date} Diagnostics
                </div>
                <div className="border-b border-border pb-2" />
                <div className="grid grid-cols-3 gap-4 divide-x divide-border">
                  <div className="space-y-1">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Top Pipeline</div>
                    <div className="text-sm md:text-base font-bold text-foreground uppercase mt-1">{activeReport.bestHabit}</div>
                  </div>
                  <div className="pl-4 space-y-1">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Critical Failure</div>
                    <div className="text-sm md:text-base font-bold text-red-500 uppercase mt-1">{activeReport.worstHabit}</div>
                  </div>
                  <div className="pl-4 space-y-1">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Longest Lapse</div>
                    <div className="text-sm md:text-base font-bold text-foreground uppercase mt-1">{activeReport.longestLapse}</div>
                  </div>
                </div>
              </div>

              {/* Right Column: AI Insights */}
              <div className="lg:col-span-2 space-y-3 lg:border-l lg:border-border lg:pl-8">
                <div className="flex items-center gap-2">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono">System Status (AI Insights)</div>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                </div>
                <p className="text-xs text-zinc-555 leading-relaxed font-mono uppercase tracking-wide">
                  {activeReport.insights}
                </p>
              </div>
            </div>
          )
        })()}
      </div>

      <div className="pt-8 border-t border-border w-full space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="border border-border bg-card p-6 rounded-[1px] text-card-foreground">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-6">6-Month Trajectory</h3>
            <div className="h-48 w-full -ml-4">
              <DynamicResponsiveContainer width="100%" height="100%">
                <LineChart data={MOCK_MONTHLY_DATA}>
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
            <div className="h-48 w-full -ml-4">
              <DynamicResponsiveContainer width="100%" height="100%">
                <BarChart data={MOCK_MONTHLY_DATA}>
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} tickFormatter={v => `${v}%`} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} dy={10} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '0px' }} itemStyle={{ color: 'var(--foreground)' }} cursor={{ fill: 'var(--muted)' }} />
                  <Bar dataKey="rate" fill="var(--foreground)" radius={0} />
                </BarChart>
              </DynamicResponsiveContainer>
            </div>
          </div>

          <div className="border border-border bg-card p-6 flex flex-col rounded-[1px] text-card-foreground">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-6">Category Spread</h3>
            <div className="flex-1 min-h-[160px] w-full relative -ml-4">
              <DynamicResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieDataRaw}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                    label={({ name, percent }: any) => (percent && percent > 0) ? `${name} ${(percent * 100).toFixed(0)}%` : null}
                    labelLine={{ stroke: '#52525b', strokeWidth: 1 }}
                    style={{ fontSize: '10px', fill: '#a1a1aa' }}
                  >
                    {pieDataRaw.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '2px', fontSize: '10px' }}
                    itemStyle={{ color: 'var(--foreground)', fontWeight: 'bold' }}
                  />
                </PieChart>
              </DynamicResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
