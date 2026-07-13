'use client'

import React, { useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { LineChart, Line, BarChart, Bar, YAxis, XAxis, Tooltip, PieChart, Pie, Cell } from 'recharts'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'

const DynamicResponsiveContainer = dynamic(
  () => import('recharts').then((mod) => mod.ResponsiveContainer),
  { ssr: false }
)
import { useHabitContext } from '@/contexts/habit-context'

const COLORS = ["#22c55e","#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16", "#ec4899", "#14b8a6", "#f97316", ];

export default function AnalyticsPage() {
  const { gridData, todayActivity, heatmapData } = useHabitContext()
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  const monthlyChartData = useMemo(() => {
  const now = new Date();

  return Array.from({ length: 6 }, (_, i) => {
    const monthDate = new Date(
      now.getFullYear(),
      now.getMonth() - (5 - i),
      1
    );

    const label = monthDate.toLocaleString("en-US", {
      month: "short",
    });

    // Temporary calculation using available heatmap data.
    // Replace later with true date-based history.
    const start = Math.floor((heatmapData.length / 6) * i);
    const end = Math.floor((heatmapData.length / 6) * (i + 1));

    const slice = heatmapData.slice(start, end);

    const total = slice.reduce((a, b) => a + b.count, 0);

    const max = slice.length * gridData.length;

        return {
          month: label,
          rate: max
            ? Math.round((total / max) * 100)
            : 0,
          volume: total,
        };
      });
    }, [heatmapData, gridData]);


  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, isLoading, router])

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

  const diagnostics = useMemo(() => {
    const habitStats = gridData.map(habit => {
      const completed = habit.days.filter(day => day.completed).length;

      const scheduled = habit.days.filter(day => {
        const date = new Date();
        date.setDate(date.getDate() - (30 - day.day));

        return (
          !habit.frequency ||
          habit.frequency.includes(date.getDay())
        );
      }).length;

      const rate = scheduled
        ? Math.round((completed / scheduled) * 100)
        : 0;

      return {
        name: habit.name,
        completed,
        scheduled,
        rate,
      };
    });

    const sorted = [...habitStats].sort((a, b) => b.rate - a.rate);

    const topHabit = sorted[0];
    const weakestHabit = sorted[sorted.length - 1];

    const activeDays = Array.from({ length: 30 }, (_, i) =>
      gridData.some(habit => habit.days[i]?.completed)
    );

    let longestLapse = 0;
    let currentGap = 0;

    for (const active of activeDays) {
      if (!active) {
        currentGap++;
        longestLapse = Math.max(longestLapse, currentGap);
      } else {
        currentGap = 0;
      }
    }

    const completionRate =
      totalScheduledDays === 0
        ? 0
        : Math.round((monthlyTotalCompletedDays / totalScheduledDays) * 100);

    let insight = "";

    if (completionRate >= 90) {
      insight =
        "Outstanding consistency. Your habits are operating on autopilot.";
    } else if (completionRate >= 75) {
      insight =
        "Excellent momentum. Protect your current streak.";
    } else if (completionRate >= 50) {
      insight =
        "Momentum is building. Avoid missing consecutive days.";
    } else if (completionRate >= 25) {
      insight =
        "Completion rate is healthy, but daily consistency can improve.";
    } else {
      insight =
        "Consistency is low. Focus on completing one core habit every day.";
    }

    return {
      month: new Date().toLocaleString("default", {
        month: "long",
        year: "numeric",
      }),

      completionRate,

      topHabit,

      weakestHabit,

      longestLapse,

      insight,
    };
    }, [
        gridData,
        monthlyTotalCompletedDays,
        totalScheduledDays,

    ]);
    
  const allTimeTotalTicks = heatmapData.reduce((acc, day) => acc + day.count, 0)

  let allTimeMaxStreak = 0;
  let runningStreak = 0;
  for (const day of heatmapData) {
    if (day.count > 0) {
      runningStreak++;
      if (runningStreak > allTimeMaxStreak) allTimeMaxStreak = runningStreak;
    } else {
      runningStreak = 0;
    }
  }

  // Current streak: don't zero out just because *today* hasn't been
  // logged yet. Walk backward from today; if today is empty, start
  // from yesterday instead, so an in-progress day doesn't wipe a
  // real streak the user is still in the middle of.
  let currentStreak = 0;
  const todayHasActivity = (heatmapData[heatmapData.length - 1]?.count || 0) > 0;
  const streakStartIndex = todayHasActivity ? heatmapData.length - 1 : heatmapData.length - 2;
  for (let i = streakStartIndex; i >= 0; i--) {
    if (heatmapData[i].count > 0) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Calculate current operating state based on current streak
  let currentOperatingState = 'INITIATION';
  if (currentStreak > 21) {
    currentOperatingState = 'AUTOMATED';
  } else if (currentStreak > 0) {
    currentOperatingState = 'MOMENTUM';
  }

  const pieDataRaw = gridData
  .map(habit => ({
    name: habit.name,
    value: habit.days.filter(day => day.completed).length,
  }))
  .filter(habit => habit.value > 0);

  
  
  if (todayActivity.sportsLog.length > 0) {
    pieDataRaw.push({ name: 'Sports', value: todayActivity.sportsLog.length });
  }

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
    <div className="max-w-300 mx-auto px-6 pt-12 pb-24 space-y-12 text-foreground">

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
          <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Day {currentStreak}</div>
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
          <div className="text-[10px] font-bold uppercase tracking-widest">
            <span className="text-green-500">{monthlyTotalActiveDays}</span>
            <span className="text-zinc-500"> / 30 Days Logged</span>
          </div>
        </div>
      </div>

      {/* System Diagnostics Section */}
      <div className="space-y-6 pt-8 border-t border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold uppercase tracking-widest text-foreground">System Diagnostics Section</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-3 space-y-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            {diagnostics.month} Diagnostics
          </div>

          <div className="border-b border-border pb-2" />

          <div className="grid grid-cols-3 gap-4 divide-x divide-border">
            <div className="space-y-1">
              <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                Top Pipeline
              </div>

              <div className="text-sm md:text-base font-bold text-green-500 mt-1">
                {diagnostics.topHabit.name} ({diagnostics.topHabit.rate}%)
              </div>
            </div>

            <div className="pl-4 space-y-1">
              <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                Critical Failure
              </div>

              <div className="text-sm md:text-base font-bold text-red-500 mt-1">
                {diagnostics.weakestHabit.name} ({diagnostics.weakestHabit.rate}%)
              </div>
            </div>

            <div className="pl-4 space-y-1">
              <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                Longest Lapse
              </div>

              <div className="text-sm md:text-base font-bold text-foreground mt-1">
                {diagnostics.longestLapse}{" "}
                {diagnostics.longestLapse === 1 ? "Day" : "Days"}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-3 lg:border-l lg:border-border lg:pl-8">
          <div className="flex items-center gap-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              System Status
            </div>

            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          </div>

          <p className="text-xs text-zinc-500 leading-relaxed">
            {diagnostics.insight}
          </p>
        </div>
      </div>
      
      </div>

      <div className="pt-8 border-t border-border w-full space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="border border-border bg-card p-6 rounded-[1px] text-card-foreground">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-6">6-Month Trajectory</h3>
            <div className="h-48 w-full -ml-4">
              <DynamicResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyChartData}>
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} tickFormatter={v => `${v}%`} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} dy={10} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }} itemStyle={{ color: 'var(--foreground)', fontWeight: "bold", }} />
                  <Line type="stepAfter" dataKey="rate" stroke="var(--foreground)" strokeWidth={2} dot={false} />
                </LineChart>
              </DynamicResponsiveContainer>
            </div>
          </div>

          <div className="border border-border bg-card p-6 rounded-[1px] text-card-foreground">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-6">Monthly Volume</h3>
            <div className="h-48 w-full -ml-4">
              <DynamicResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData}>
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} tickFormatter={v => `${v}%`} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#71717a' }} dy={10} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '0px' }} itemStyle={{ color: 'var(--foreground)' }} cursor={{ fill: 'var(--muted)' }} />
                  <Bar dataKey="volume" fill="var(--foreground)" radius={0} />
                </BarChart>
              </DynamicResponsiveContainer>
            </div>
          </div>

          <div className="border border-border bg-card p-6 flex flex-col rounded-[1px] text-card-foreground">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-6">Habit Completion</h3>
            <div className="flex-1 min-h-40 w-full relative -ml-4">
              <DynamicResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie isAnimationActive={false}
                    data={pieDataRaw}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="#18181b"
                    strokeWidth={2}
                    label={({ name, percent }: { name?: string; percent?: number }) => (percent && percent > 0) ? `${name} ${(percent * 100).toFixed(0)}%` : null}
                    labelLine={{ stroke: '#52525b', strokeWidth: 1 }}
                    style={{ fontSize: '10px', fill: '#a1a1aa' }}
                  >
                    {pieDataRaw.map((entry, index) => (
                    <Cell
                        key={entry.name}
                        fill={COLORS[index % COLORS.length]}
                        stroke={COLORS[index % COLORS.length]}
                        strokeWidth={1}
                      />
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
