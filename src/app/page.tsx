'use client'

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
const DynamicResponsiveContainer = dynamic(
  () => import('recharts').then((mod) => mod.ResponsiveContainer),
  { ssr: false }
)
import { Check, Flame, Rocket, ChevronLeft, ChevronRight, Minus, Bell } from 'lucide-react'
import { NutritionTracker } from '@/components/dashboard/nutrition-tracker'
import { ActivityMetricsTracker } from '@/components/dashboard/activity-metrics-tracker'
import { UnifiedHabitCalendar } from '@/components/dashboard/unified-habit-calendar'
import { CanvasLoader } from '@/components/ui/canvas-loader'
import { useSettings, formatTime } from '@/hooks/useSettings'
import { useHabitContext } from '@/contexts/habit-context'
import { useAuth } from '@/contexts/auth-context'
import { getFirebaseMessaging, requestAndStoreNotificationToken } from '@/lib/firebase'
import { onMessage } from 'firebase/messaging'
import { toast } from 'sonner'



export default function BrutalistDashboard() {
  const { timeFormat } = useSettings()
  const { gridData, todayHabits, toggleTodayHabit, toggleGridHabit, heatmapData, isMounted, isInitialized, initializeJourney } = useHabitContext()
  const { isAuthenticated, isLoading: authLoading, user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [selectedWeek, setSelectedWeek] = useState<'all' | 1 | 2 | 3 | 4>('all')
  const [animatingCells, setAnimatingCells] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const checkStagnant = () => {
      const STAGNANT_TIME = 5 * 60 * 1000; // 5 minutes
      const now = Date.now();

      const hasSeenLoader = sessionStorage.getItem('habitflow_has_seen_loader');
      const lastActiveStr = localStorage.getItem('habitflow_last_active');

      if (!hasSeenLoader) {
        // First time loading in this session
        setLoading(true);
        sessionStorage.setItem('habitflow_has_seen_loader', 'true');
      } else if (lastActiveStr) {
        // Returning user, check if stagnant
        const lastActive = parseInt(lastActiveStr, 10);
        if (now - lastActive > STAGNANT_TIME) {
          setLoading(true);
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    // Check initially
    checkStagnant();

    // Check again when user refocuses tab
    const onFocus = () => checkStagnant();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  useEffect(() => {
    if (isAuthenticated && isMounted) {
      let active = true;
      let unsubscribe: (() => void) | undefined;
      getFirebaseMessaging().then(messaging => {
        if (!messaging || !active) return;
        unsubscribe = onMessage(messaging, (payload) => {
          console.log("Foreground push notification received:", payload);
          // Trigger the loud native OS Notification instead of a quiet toast
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(payload.notification?.title || 'HabytFlow Reminder', {
              body: payload.notification?.body,
              icon: '/favicon.ico',
              requireInteraction: true
            });
          } else {
            toast.info(`${payload.notification?.title}: ${payload.notification?.body}`);
          }
        });
      });
      return () => {
        active = false;
        if (unsubscribe) unsubscribe();
      }
    }
  }, [isAuthenticated, isMounted]);

  // Automatically sync FCM token if permission was already granted
  useEffect(() => {
    if (isAuthenticated && user?.id && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      requestAndStoreNotificationToken(user.id)
    }
  }, [isAuthenticated, user?.id])

  // Completion Trend Data (Mapped to current calendar month)
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const completionRateData = Array.from({ length: daysInMonth }).map((_, i) => {
    const actualCalendarDay = i + 1;
    const dateForThisDay = new Date(currentYear, currentMonth, actualCalendarDay);
    
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const targetMidnight = new Date(currentYear, currentMonth, actualCalendarDay);
    
    const diffTime = targetMidnight.getTime() - todayMidnight.getTime();
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
    
    let rate = null; // Out of rolling window or in future
    
    if (diffDays <= 0 && diffDays >= -29) {
      const relativeDayNum = 30 + diffDays;
      let completed = 0;
      let totalScheduled = 0;
      const dayOfWeek = dateForThisDay.getDay();

      gridData.forEach(habit => {
        const isScheduled = habit.frequency ? habit.frequency.includes(dayOfWeek) : true;
        if (isScheduled) {
          totalScheduled++;
          if (habit.days.find(d => d.day === relativeDayNum)?.completed) completed++;
        }
      });
      rate = totalScheduled === 0 ? 0 : Math.round((completed / totalScheduled) * 100);
    }

    return {
      day: actualCalendarDay,
      rate: rate
    };
  });

  const filteredCompletionRate = selectedWeek === 'all'
    ? completionRateData
    : completionRateData.filter(d => {
      if (selectedWeek === 1) return d.day >= 1 && d.day <= 7;
      if (selectedWeek === 2) return d.day >= 8 && d.day <= 14;
      if (selectedWeek === 3) return d.day >= 15 && d.day <= 21;
      if (selectedWeek === 4) return d.day >= 22 && d.day <= 30;
      return true;
    });



  const toggleDay = (habitId: number, dayNum: number) => {
    const key = `${habitId}-${dayNum}`
    setAnimatingCells(prev => ({ ...prev, [key]: true }))
    setTimeout(() => {
      setAnimatingCells(prev => ({ ...prev, [key]: false }))
    }, 300)

    toggleGridHabit(habitId, dayNum)
  }

  // Helper for heatmap colors
  const getHeatmapColor = (count: number) => {
    if (count === 0) return 'bg-zinc-900'
    if (count <= 2) return 'bg-white'
    if (count <= 4) return 'bg-green-500'
    return 'bg-green-800'
  }

  // Calculate consecutive missed days up to the most recent day in the grid window
  const getStatusColor = (days: { day: number, completed: boolean }[]) => {
    let missedDays = 0;
    for (let i = days.length - 1; i >= Math.max(0, days.length - 7); i--) {
      if (!days[i]?.completed) missedDays++;
      else break;
    }
    if (missedDays >= 7) return 'bg-red-500' // Danger zone (> 1 week)
    if (missedDays >= 1) return 'bg-yellow-500' // Losing habit (1-6 days)
    return 'bg-green-500' // Active streak
  }

  return (
    <>
      {loading && <CanvasLoader onComplete={() => setLoading(false)} />}
      
      <div className={`max-w-[1000px] mx-auto px-6 pt-8 pb-24 space-y-8 ${(loading || authLoading || !isMounted) ? 'opacity-0 h-screen overflow-hidden' : 'opacity-100 transition-opacity duration-700'}`}>
      
        {/* Initialization Banner */}
        {!isInitialized && (
          <div className="border border-green-900 bg-green-950/20 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3">
              <h2 className="text-white text-xl font-bold uppercase tracking-widest flex items-center gap-2">
                <Rocket className="text-white" /> INITIALIZE YOUR JOURNEY
              </h2>
              <p className="text-zinc-400 text-sm max-w-3xl leading-relaxed">
                Welcome to HabytFlow. You are currently viewing simulated preview data. To begin tracking your real activity, initialize your profile. This will erase the preview data and prepare a blank slate.
              </p>
            </div>
            <button 
              onClick={() => initializeJourney()}
              className="bg-green-500 text-black px-8 py-3 font-black uppercase tracking-widest text-sm hover:bg-green-400 transition-colors whitespace-nowrap shrink-0"
            >
              START TRACKING &gt;
            </button>
          </div>
        )}

        {/* Section B: Today's Action Items */}
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-white text-xl font-bold uppercase tracking-widest hidden md:block">Today's Action Items</h2>
          {typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && (
            <button 
              onClick={() => requestAndStoreNotificationToken(user?.id!)}
              className="flex items-center gap-2 border border-zinc-800 bg-black text-white px-4 py-2 text-[10px] font-bold tracking-widest uppercase hover:bg-zinc-900 transition-colors animate-pulse"
            >
              <Bell size={14} /> Enable Notifications
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {gridData.length === 0 && (
            <div className="col-span-full border border-zinc-800 bg-zinc-950 p-8 flex flex-col items-center justify-center text-center">
              <h3 className="text-white text-lg font-bold uppercase tracking-widest mb-2">No Habits Configured</h3>
              <p className="text-zinc-500 text-sm mb-6">You haven't set up any habits to track yet.</p>
              <button onClick={() => router.push('/habits')} className="bg-white text-black px-6 py-2 font-bold uppercase tracking-wider text-xs hover:bg-zinc-200 transition-colors">
                Go to Manage Habits
              </button>
            </div>
          )}
          {gridData.length > 0 && gridData.filter(h => h.frequency ? h.frequency.includes(new Date().getDay()) : true).length === 0 && (
            <div className="col-span-full border border-zinc-800 bg-zinc-950 p-8 flex flex-col items-center justify-center text-center">
              <h3 className="text-white text-lg font-bold uppercase tracking-widest mb-2">Rest Day</h3>
              <p className="text-zinc-500 text-sm">You have no habits scheduled for today.</p>
            </div>
          )}
          {gridData.filter(habit => habit.frequency ? habit.frequency.includes(new Date().getDay()) : true).map(habit => {
            const isCompleted = todayHabits.includes(habit.id);

            const BRUTALIST_COLORS = [
              "bg-[#ef4444] text-black border-[#ef4444]", // Red
              "bg-[#3b82f6] text-black border-[#3b82f6]", // Blue
              "bg-[#eab308] text-black border-[#eab308]", // Yellow
              "bg-[#a855f7] text-black border-[#a855f7]", // Purple
              "bg-[#06b6d4] text-black border-[#06b6d4]", // Cyan
              "bg-[#ec4899] text-black border-[#ec4899]", // Pink
              "bg-[#f97316] text-black border-[#f97316]", // Orange
              "bg-[#84cc16] text-black border-[#84cc16]", // Lime
              "bg-[#10b981] text-black border-[#10b981]", // Emerald
            ];
            let colorClass = BRUTALIST_COLORS[habit.id % BRUTALIST_COLORS.length];

            if (isCompleted) {
              colorClass = "bg-zinc-900 text-zinc-600 border-zinc-800 opacity-50 grayscale";
            }

            return (
              <button
                key={habit.id}
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
                  toggleTodayHabit(habit.id);
                }}
                className={`p-3 md:p-4 flex flex-col justify-between min-h-[80px] md:min-h-[100px] border rounded-[1px] transition-all duration-300 transform active:scale-95 text-left ${colorClass}`}
              >
                <div className="flex justify-between items-start w-full">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-80">{habit.category}</span>
                  <div className="flex items-center gap-2">
                    <AnimatePresence>
                      {isCompleted && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        >
                          <Check size={16} strokeWidth={4} className="text-zinc-500" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {habit.time && (
                      <span className="text-[10px] font-black text-white tracking-widest bg-black/30 px-1.5 py-0.5 rounded-[1px] shadow-sm">
                        {formatTime(habit.time, timeFormat)}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`text-base md:text-lg font-black uppercase leading-tight mt-2 ${isCompleted ? 'line-through opacity-70' : ''}`}>
                  {habit.name}
                </span>
              </button>
            )
          })}
        </div>

        {/* Nutrition Trackers inserted above line graph */}
        <NutritionTracker />

        {/* Activity Metrics (Sports & HR) */}
        <ActivityMetricsTracker />

        {/* 30-Day Grid Trend Cards */}
        <div className="w-full">
          {gridData.length === 0 ? (
            <div className="border border-zinc-800 bg-zinc-950 p-8 flex flex-col items-center justify-center text-center">
              <h3 className="text-white text-lg font-bold uppercase tracking-widest mb-2">No Tracking Data</h3>
              <p className="text-zinc-500 text-sm mb-6">Add habits to see your 30-day trends.</p>
            </div>
          ) : (
            <UnifiedHabitCalendar gridData={gridData} />
          )}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 gap-6">
          {/* Flatline Completion Graph */}
          <div className="border border-zinc-900 bg-black p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-white">Completion Trend</h3>
              <div className="flex items-center gap-2">
                {(['all', 1, 2, 3, 4] as const).map(w => (
                  <button
                    key={w}
                    onClick={() => setSelectedWeek(w)}
                    className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest rounded-[1px] border ${selectedWeek === w ? 'bg-white text-black border-white' : 'bg-transparent text-zinc-500 border-zinc-800 hover:text-white transition-colors'}`}
                  >
                    {w === 'all' ? 'Month' : `Wk ${w}`}
                  </button>
                ))}
              </div>
            </div>
            <div className="w-full overflow-x-auto pb-2">
              <div className="h-40 min-w-[600px] w-full -ml-2">
              <DynamicResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredCompletionRate} margin={{ top: 5, right: 15, left: -15, bottom: 0 }}>
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: '#52525b' }}
                    dy={10}
                    interval={0}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 50, 100]}
                    tickFormatter={(val) => `${val}%`}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 9, fill: '#52525b' }}
                  />
                  <Tooltip
                    cursor={{ stroke: '#ffffff', strokeWidth: 1, strokeDasharray: '3 3' }}
                    contentStyle={{ backgroundColor: '#ffffff', color: '#000000', border: 'none', borderRadius: '0px', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '12px' }}
                    itemStyle={{ color: '#000000' }}
                    labelStyle={{ color: '#000000', marginBottom: '4px' }}
                    formatter={(value: any) => [`${value}% completed`, 'Trend']}
                    labelFormatter={(label) => {
                      return new Date(currentYear, currentMonth, Number(label)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    }}
                  />
                  <ReferenceLine x={new Date().getDate()} stroke="#52525b" strokeDasharray="3 3" />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#ffffff"
                    strokeWidth={2}
                    dot={{ r: 2, fill: '#000', stroke: '#fff', strokeWidth: 1.5 }}
                    activeDot={{ r: 4, fill: '#fff' }}
                    isAnimationActive={false}
                    connectNulls={true}
                  />
                </LineChart>
              </DynamicResponsiveContainer>
              </div>
            </div>
          </div>
        </div>



        {/* Micro Yearly Heatmap */}
        <div className="border border-zinc-900 bg-black p-4 overflow-x-auto">
          <div className="mb-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white">Yearly Matrix</h3>
          </div>
          <div className="flex items-start gap-3 min-w-max">
            <div className="flex flex-col justify-between text-[8px] text-zinc-600 uppercase tracking-widest h-[76px] pt-[14px] pb-1 pr-1">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-[8px] text-zinc-600 uppercase tracking-widest mb-1.5 pl-1 pr-8">
                <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
                <span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
              </div>
              <div className="grid grid-rows-7 grid-flow-col gap-[2px]">
                {heatmapData.map((day, index) => {
                  const daysAgo = heatmapData.length - 1 - index;
                  const d = new Date();
                  d.setDate(d.getDate() - daysAgo);
                  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                  return (
                    <div
                      key={day.id}
                      className={`w-2.5 h-2.5 rounded-[1px] transition-all duration-150 ease-out hover:scale-125 hover:bg-white hover:z-10 relative group ${getHeatmapColor(day.count)}`}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-white text-black text-[10px] font-bold px-2 py-1 whitespace-nowrap z-50 pointer-events-none shadow-lg">
                        {dateStr}: {day.count} Habits
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  )
}
