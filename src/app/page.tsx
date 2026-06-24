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
  const { 
    gridData, 
    todayHabits, 
    toggleTodayHabit, 
    toggleGridHabit, 
    heatmapData, 
    isMounted, 
    isInitialized, 
    initializeJourney,
    currentSystemDate
  } = useHabitContext()
  const { isAuthenticated, isLoading: authLoading, user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [selectedWeek, setSelectedWeek] = useState<'all' | 1 | 2 | 3 | 4>('all')
  const [animatingCells, setAnimatingCells] = useState<Record<string, boolean>>({})
  const [showNotifPrompt, setShowNotifPrompt] = useState(false)

  const todayDay = new Date().getDate()
  const [selectedDay, setSelectedDay] = useState<number>(todayDay)

  useEffect(() => {
    if (isMounted) {
      setSelectedDay(new Date().getDate())
    }
  }, [currentSystemDate, isMounted])

  // Self-repair to clear the glitchy completions on June 10 caused by the previous index mismatch
  useEffect(() => {
    if (isMounted && gridData.length > 0) {
      const repairedKey = 'habitflow_glitch_repaired_jun10';
      if (!localStorage.getItem(repairedKey)) {
        gridData.forEach(h => {
          if (h.days && h.days[16]?.completed) {
            toggleGridHabit(h.id, h.days[16].day);
          }
        });
        localStorage.setItem(repairedKey, 'true');
      }
    }
  }, [isMounted, gridData, toggleGridHabit])

  // Do not show the notification prompt banner automatically when PWA opens
  // Users can still click 'Enable Notifications' manually when completing a habit.

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

  // Cleanup legacy/duplicate service worker registrations to prevent Android system notifications
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          const scriptURL = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
          if (scriptURL && (scriptURL.includes('firebase-messaging-sw.js') || !scriptURL.endsWith('/sw.js'))) {
            console.log('Unregistering legacy/conflicting service worker:', scriptURL);
            reg.unregister().then((success) => {
              if (success) {
                console.log('Successfully unregistered legacy service worker:', scriptURL);
              }
            }).catch(err => {
              console.error('Failed to unregister legacy service worker:', scriptURL, err);
            });
          }
        }
      }).catch(err => {
        console.error('Error getting service worker registrations:', err);
      });
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && isMounted) {
      let active = true;
      let unsubscribe: (() => void) | undefined;
      getFirebaseMessaging().then(messaging => {
        if (!messaging || !active) return;
        unsubscribe = onMessage(messaging, (payload) => {
          console.log("Foreground push notification received:", payload);
          // Extract title and body supporting both data and notification payloads
          const title = payload.data?.title || payload.notification?.title || 'HabytFlow Reminder';
          const body = payload.data?.body || payload.notification?.body || '';

          // Show in-app toast for foreground notifications instead of spamming native OS popups
          toast.info(`${title}: ${body}`);
        });
      });
      return () => {
        active = false;
        if (unsubscribe) unsubscribe();
      }
    }
  }, [isAuthenticated, isMounted]);

  // Automatically sync FCM token if permission was already granted to keep the token fresh in the database on launch
  useEffect(() => {
    if (isAuthenticated && user?.id && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      requestAndStoreNotificationToken(user.id);
    }
  }, [isAuthenticated, user?.id])

  // Listen for Service Worker updates to prompt users to reload and use the latest PWA version
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const handleControllerChange = () => {
        toast.info("A new version of HabytFlow is available!", {
          description: "Tap 'Reload' to update and use the latest features.",
          duration: Infinity,
          action: {
            label: "Reload",
            onClick: () => {
              window.location.reload();
            }
          }
        });
      };

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      };
    }
  }, []);

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
          const dayIndex = (habit.days?.length || 30) - 1 + diffDays;
          if (habit.days && habit.days[dayIndex]?.completed) {
            completed++;
          }
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



  // Selected day time-travel date calculations
  const dateForSelectedDay = new Date(currentYear, currentMonth, selectedDay);
  const dayOfWeekForSelectedDay = dateForSelectedDay.getDay();
  const isSelectedDayToday = selectedDay === todayDay;

  const todayObj = new Date();
  const todayMidnight = new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate());
  const targetMidnight = new Date(currentYear, currentMonth, selectedDay);
  const diffTimeForSelectedDay = targetMidnight.getTime() - todayMidnight.getTime();
  const diffDaysForSelectedDay = Math.round(diffTimeForSelectedDay / (1000 * 3600 * 24));

  const scheduledHabitsForSelectedDay = gridData.filter(habit =>
    habit.frequency ? habit.frequency.includes(dayOfWeekForSelectedDay) : true
  );

  const getIsCompleted = (habit: typeof gridData[0]) => {
    if (diffDaysForSelectedDay === 0) {
      return todayHabits.includes(habit.id);
    } else {
      const dayIndex = (habit.days?.length || 30) - 1 + diffDaysForSelectedDay;
      return habit.days ? !!habit.days[dayIndex]?.completed : false;
    }
  };

  const handleToggleHabit = (habitId: number) => {
    if (diffDaysForSelectedDay !== 0 && diffDaysForSelectedDay !== -1) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
    if (diffDaysForSelectedDay === 0) {
      toggleTodayHabit(habitId);
    } else {
      const habit = gridData.find(h => h.id === habitId);
      if (habit && habit.days) {
        const dayIndex = habit.days.length - 1 + diffDaysForSelectedDay;
        if (dayIndex >= 0 && dayIndex < habit.days.length) {
          const targetDayVal = habit.days[dayIndex].day;
          toggleGridHabit(habitId, targetDayVal);
        }
      }
    }
  };

  // Selected date string, e.g. "Jun 23"
  const selectedDateStr = dateForSelectedDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

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
    if (count === 0) return 'bg-zinc-200 dark:bg-zinc-900'
    if (count <= 2) return 'bg-zinc-400 dark:bg-zinc-650'
    if (count <= 4) return 'bg-green-400 dark:bg-green-600'
    return 'bg-green-600 dark:bg-green-850'
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

      <div className={`max-w-[1000px] mx-auto px-6 pt-8 pb-24 space-y-5 ${(loading || authLoading || !isMounted) ? 'opacity-0 h-screen overflow-hidden' : 'opacity-100 transition-opacity duration-700'} text-foreground`}>

        {/* Initialization Banner */}
        {!isInitialized && (
          <div className="border border-green-900/50 bg-green-950/10 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3">
              <h2 className="text-foreground text-xl font-bold uppercase tracking-widest flex items-center gap-2">
                <Rocket className="text-foreground" /> INITIALIZE YOUR JOURNEY
              </h2>
              <p className="text-zinc-500 text-sm max-w-3xl leading-relaxed">
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

        {/* Section B: Action Items */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <h2 className="text-foreground text-base md:text-xl font-bold uppercase tracking-widest">
              {isSelectedDayToday ? "Today's Action Items" : `Action Items for ${selectedDateStr}`}
            </h2>
            {!isSelectedDayToday && (
              <button
                onClick={() => setSelectedDay(todayDay)}
                className="flex items-center gap-1 border border-border bg-card text-foreground px-2 py-1 text-[9px] md:text-[10px] font-bold tracking-widest uppercase hover:bg-muted transition-colors rounded-[2px]"
              >
                Back to Today
              </button>
            )}
          </div>
          {isSelectedDayToday && typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && (
            <button
              onClick={() => requestAndStoreNotificationToken(user?.id!)}
              className="flex items-center gap-2 border border-border bg-card text-foreground px-4 py-2 text-[10px] font-bold tracking-widest uppercase hover:bg-muted transition-colors animate-pulse self-start sm:self-auto"
            >
              <Bell size={14} /> Enable Notifications
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {gridData.length === 0 && (
            <div className="col-span-full border border-border bg-card p-8 flex flex-col items-center justify-center text-center">
              <h3 className="text-foreground text-lg font-bold uppercase tracking-widest mb-2">No Habits Configured</h3>
              <p className="text-zinc-500 text-sm mb-6">You haven't set up any habits to track yet.</p>
              <button onClick={() => router.push('/habits')} className="bg-foreground text-background px-6 py-2 font-bold uppercase tracking-wider text-xs hover:bg-foreground/90 transition-colors">
                Go to Manage Habits
              </button>
            </div>
          )}
          {gridData.length > 0 && scheduledHabitsForSelectedDay.length === 0 && (
            <div className="col-span-full border border-border bg-card p-8 flex flex-col items-center justify-center text-center">
              <h3 className="text-foreground text-lg font-bold uppercase tracking-widest mb-2">Rest Day</h3>
              <p className="text-zinc-500 text-sm">You have no habits scheduled for this day.</p>
            </div>
          )}
          {scheduledHabitsForSelectedDay.map(habit => {
            const isCompleted = getIsCompleted(habit);

            const BRUTALIST_COLORS = [
              "bg-[#ef4444] text-white border-[#ef4444]", // Red
              "bg-[#3b82f6] text-white border-[#3b82f6]", // Blue
              "bg-[#eab308] text-white border-[#eab308]", // Yellow
              "bg-[#a855f7] text-white border-[#a855f7]", // Purple
              "bg-[#06b6d4] text-white border-[#06b6d4]", // Cyan
              "bg-[#ec4899] text-white border-[#ec4899]", // Pink
              "bg-[#f97316] text-white border-[#f97316]", // Orange
              "bg-[#84cc16] text-white border-[#84cc16]", // Lime
              "bg-[#10b981] text-white border-[#10b981]", // Emerald
            ];
            let colorClass = BRUTALIST_COLORS[habit.id % BRUTALIST_COLORS.length];

            if (isCompleted) {
              colorClass = "bg-muted text-zinc-555 border-border opacity-50 grayscale";
            }

            return (
              <button
                key={habit.id}
                onClick={() => handleToggleHabit(habit.id)}
                className={`p-3 md:p-4 flex flex-col justify-between min-h-[80px] md:min-h-[100px] border rounded-[1px] transition-all duration-300 transform active:scale-95 text-left ${colorClass}`}
              >
                <div className="flex justify-between items-start w-full">
                  <span className="text-[11px] md:text-xs font-black uppercase tracking-widest opacity-80">{habit.category}</span>
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
                      <span className="text-[11px] md:text-xs font-black text-foreground tracking-widest bg-foreground/10 px-1.5 py-0.5 rounded-[1px] shadow-sm">
                        {formatTime(habit.time, timeFormat)}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`text-base md:text-lg font-black uppercase leading-tight mt-2 ${isCompleted ? 'line-through opacity-70' : 'text-black'}`}>
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
            <div className="border border-border bg-card p-8 flex flex-col items-center justify-center text-center">
              <h3 className="text-foreground text-lg font-bold uppercase tracking-widest mb-2">No Tracking Data</h3>
              <p className="text-zinc-500 text-sm mb-6">Add habits to see your 30-day trends.</p>
            </div>
          ) : (
            <UnifiedHabitCalendar 
              gridData={gridData} 
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />
          )}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 gap-6">
          {/* Flatline Completion Graph */}
          <div className="border border-border bg-card p-4 text-card-foreground">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-foreground">Completion Trend</h3>
              <div className="flex items-center gap-2">
                {(['all', 1, 2, 3, 4] as const).map(w => (
                  <button
                    key={w}
                    onClick={() => setSelectedWeek(w)}
                    className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest rounded-[1px] border ${selectedWeek === w ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-zinc-500 border-border hover:text-foreground transition-colors'}`}
                  >
                    {w === 'all' ? 'Month' : `Wk ${w}`}
                  </button>
                ))}
              </div>
            </div>
            <div className="w-full overflow-x-auto pb-2">
              <div className="h-40 min-w-[600px] w-full -ml-2">
                <DynamicResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
                      cursor={{ stroke: 'var(--foreground)', strokeWidth: 1, strokeDasharray: '3 3' }}
                      contentStyle={{ backgroundColor: 'var(--background)', color: 'var(--foreground)', border: 'none', borderRadius: '0px', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '12px' }}
                      itemStyle={{ color: 'var(--foreground)' }}
                      labelStyle={{ color: 'var(--foreground)', marginBottom: '4px' }}
                      formatter={(value: any) => [`${value}% completed`, 'Trend']}
                      labelFormatter={(label) => {
                        return new Date(currentYear, currentMonth, Number(label)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                      }}
                    />
                    <ReferenceLine x={new Date().getDate()} stroke="#52525b" strokeDasharray="3 3" />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      stroke="var(--foreground)"
                      strokeWidth={2}
                      dot={{ r: 2, fill: 'var(--background)', stroke: 'var(--foreground)', strokeWidth: 1.5 }}
                      activeDot={{ r: 4, fill: 'var(--foreground)' }}
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
        <div className="border border-border bg-card p-4 overflow-x-auto text-card-foreground">
          <div className="mb-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-foreground">Yearly Matrix</h3>
          </div>
          <div className="flex items-start gap-3 min-w-max">
            <div className="flex flex-col justify-between text-[8px] text-zinc-650 uppercase tracking-widest h-[76px] pt-[14px] pb-1 pr-1">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-[8px] text-zinc-650 uppercase tracking-widest mb-1.5 pl-1 pr-8">
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
                      className={`w-2.5 h-2.5 rounded-[1px] transition-all duration-150 ease-out hover:scale-125 hover:bg-foreground hover:z-10 relative group ${getHeatmapColor(day.count)}`}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-background text-foreground border border-border text-[10px] font-bold px-2 py-1 whitespace-nowrap z-50 pointer-events-none shadow-lg">
                        {dateStr}: {day.count} Habits
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Floating Brutalist Notification Banner */}
        <AnimatePresence>
          {showNotifPrompt && isMounted && isAuthenticated && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default' && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-6 right-6 z-50 max-w-sm border-2 border-foreground bg-background p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]"
            >
              <div className="flex items-start gap-4">
                <div className="bg-foreground text-background p-2">
                  <Bell className="h-5 w-5 animate-bounce" />
                </div>
                <div className="space-y-2 flex-1">
                  <h4 className="font-bold uppercase tracking-wider text-xs text-foreground">STREAK PROTECTION REMINDER</h4>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Protect your progress! Allow push notifications to receive real-time habit reminders on this device.
                  </p>
                  <div className="flex gap-4 pt-1.5">
                    <button
                      onClick={() => {
                        requestAndStoreNotificationToken(user?.id!)
                        setShowNotifPrompt(false)
                      }}
                      className="bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors"
                    >
                      ENABLE REMINDERS &gt;
                    </button>
                    <button
                      onClick={() => {
                        sessionStorage.setItem('habitflow_notif_prompt_dismissed', 'true')
                        setShowNotifPrompt(false)
                      }}
                      className="text-zinc-500 hover:text-foreground text-[10px] font-bold uppercase tracking-wider transition-colors"
                    >
                      Maybe Later
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </>
  )
}
