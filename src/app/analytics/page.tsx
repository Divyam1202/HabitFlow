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
    insights: 'Excellent momentum this month. Gym consistency improved by 15% compared to May. Week 3 saw a minor dip due to travel, but recovery was immediate.'
  },
  {
    id: 'may-2026',
    date: 'May 2026',
    completionRate: 85,
    activeDays: 26,
    bestHabit: 'Meditation (90%)',
    worstHabit: 'Gym (50%)',
    insights: 'Solid foundational month. Meditation streak reached 20 days. Gym attendance suffered in the first half of the month but picked up significantly in Week 4.'
  }
]

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

  const COLORS = ['#ffffff', '#a1a1aa', '#52525b', '#27272a', '#18181b', '#09090b'];

  return (
    <div className="max-w-[1200px] mx-auto px-6 pt-12 pb-24 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-tight text-white">Analytics</h1>
          <p className="text-zinc-500 mt-2 text-sm">Deep dive into your consistency metrics.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="flex flex-col gap-6 bg-black p-6 border border-zinc-900 rounded-[1px]">
            <div>
              <h1 className="text-xl font-bold uppercase tracking-tight text-white mb-4">Productivity Dashboard</h1>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[1px] border border-white bg-white text-black text-[10px] font-black uppercase tracking-wider min-w-max">
                  <span>🔥</span> 1 Wk
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[1px] border border-zinc-500 bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-wider min-w-max">
                  <span>⚡</span> 2 Wks
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[1px] border border-zinc-800 bg-black text-zinc-600 text-[10px] font-bold uppercase tracking-wider min-w-max opacity-50">
                  <span>🚀</span> 3 Wks
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[1px] border border-zinc-800 bg-black text-zinc-600 text-[10px] font-bold uppercase tracking-wider min-w-max opacity-50">
                  <span>🌟</span> 4 Wks
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-zinc-800 p-4 relative overflow-hidden group">
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Highest Streak (All-Time)</div>
                <div className="text-3xl font-black text-white"><AnimatedNumber start={true} value={allTimeMaxStreak} /></div>
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Flame size={48} />
                </div>
              </div>
              <div className="border border-zinc-800 p-4 relative overflow-hidden group">
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Total Ticks</div>
                <div className="text-3xl font-black text-white"><AnimatedNumber start={true} value={allTimeTotalTicks} /></div>
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Check size={48} />
                </div>
              </div>
              <div className="border border-zinc-800 p-4 relative overflow-hidden group">
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Active Days</div>
                <div className="text-3xl font-black text-white"><AnimatedNumber start={true} value={allTimeActiveDays} /></div>
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Rocket size={48} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="h-full border border-zinc-900 bg-black p-4 flex flex-col justify-center gap-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white mb-2">Monthly Stats</h3>
            <div className="space-y-4 flex-1 flex flex-col justify-center">
              <div>
                <div className="text-2xl font-black text-white tabular-nums">{Math.round((monthlyTotalCompletedDays / (totalScheduledDays || 1)) * 100)}%</div>
                <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Completion Rate</div>
              </div>
              <div>
                <div className="text-2xl font-black text-white tabular-nums">{monthlyTotalActiveDays} <span className="text-sm text-zinc-600">/ 30</span></div>
                <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Days Logged</div>
              </div>
              <div>
                <div className="text-2xl font-black text-white tabular-nums">{gridData.length}</div>
                <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Active Habits</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

        {/* Sidebar */}
        <div className="lg:col-span-1 border border-zinc-900 bg-black p-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4">Report Archive</h3>
          <div className="flex flex-col gap-2 h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 pr-2">
            {FAKE_REPORTS.map(report => (
              <button
                key={report.id}
                onClick={() => setSelectedReport(report.id)}
                className={`p-3 text-left border rounded-[1px] transition-colors uppercase tracking-wider text-[10px] font-bold ${selectedReport === report.id ? 'border-white bg-zinc-900 text-white' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'}`}
              >
                {report.date}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-8">

          {/* Detailed Report View */}
          {FAKE_REPORTS.filter(r => r.id === selectedReport).map(report => (
            <div key={report.id} className="border border-zinc-900 bg-black p-6">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
                <h2 className="text-xl font-bold uppercase tracking-tight text-white">{report.date} Summary</h2>
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-3 py-1 border border-zinc-800 bg-zinc-950">Official Report</div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="border border-zinc-800 p-4">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Completion</div>
                  <div className="text-2xl font-black text-white tabular-nums">{report.completionRate}%</div>
                </div>
                <div className="border border-zinc-800 p-4">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Active Days</div>
                  <div className="text-2xl font-black text-white tabular-nums">{report.activeDays}</div>
                </div>
                <div className="border border-zinc-800 p-4">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Top Habit</div>
                  <div className="text-sm font-bold text-green-500 uppercase tracking-tight mt-1">{report.bestHabit}</div>
                </div>
                <div className="border border-zinc-800 p-4">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Needs Work</div>
                  <div className="text-sm font-bold text-red-500 uppercase tracking-tight mt-1">{report.worstHabit}</div>
                </div>
              </div>

              <div className="border border-zinc-800 p-6 bg-zinc-950">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-white mb-3">AI Insights</h3>
                <p className="text-sm text-zinc-400 leading-relaxed font-medium">
                  {report.insights}
                </p>
              </div>
            </div>
          ))}

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="border border-zinc-900 bg-black p-6">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-6">6-Month Trajectory</h3>
              <div className="h-48 w-full -ml-4">
                <DynamicResponsiveContainer width="100%" height="100%">
                  <LineChart data={MOCK_MONTHLY_DATA}>
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} tickFormatter={v => `${v}%`} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} dy={10} />
                    <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #27272a' }} itemStyle={{ color: '#fff' }} />
                    <Line type="stepAfter" dataKey="rate" stroke="#ffffff" strokeWidth={2} dot={false} />
                  </LineChart>
                </DynamicResponsiveContainer>
              </div>
            </div>

            <div className="border border-zinc-900 bg-black p-6">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-6">Monthly Volume</h3>
              <div className="h-48 w-full -ml-4">
                <DynamicResponsiveContainer width="100%" height="100%">
                  <BarChart data={MOCK_MONTHLY_DATA}>
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} tickFormatter={v => `${v}%`} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} dy={10} />
                    <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #27272a', borderRadius: '0px' }} itemStyle={{ color: '#fff' }} cursor={{ fill: '#18181b' }} />
                    <Bar dataKey="rate" fill="#ffffff" radius={0} />
                  </BarChart>
                </DynamicResponsiveContainer>
              </div>
            </div>

            <div className="border border-zinc-900 bg-black p-6 flex flex-col">
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
                      contentStyle={{ backgroundColor: '#000', border: '1px solid #27272a', borderRadius: '2px', fontSize: '10px' }}
                      itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                    />
                  </PieChart>
                </DynamicResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
