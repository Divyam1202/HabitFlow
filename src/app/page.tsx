'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
const DynamicResponsiveContainer = dynamic(
  () => import('recharts').then((mod) => mod.ResponsiveContainer),
  { ssr: false }
)
import { Check, Rocket, Bell } from 'lucide-react'
import { NutritionTracker } from '@/components/dashboard/nutrition-tracker'
import { ActivityMetricsTracker } from '@/components/dashboard/activity-metrics-tracker'
import { UnifiedHabitCalendar } from '@/components/dashboard/unified-habit-calendar'
import { useSettings, formatTime } from '@/hooks/useSettings'
import { useHabitContext } from '@/contexts/habit-context'
import { useAuth } from '@/contexts/auth-context'
import { getFirebaseMessaging, requestAndStoreNotificationToken } from '@/lib/firebase'
import { useAnalyticsSnapshot } from '@/hooks/useAnalyticsSnapshot'
import { onMessage } from 'firebase/messaging'
import { toast } from 'sonner'
import { calculateDailyRecordsForYear, getDayDiff, getGridDayStats, toDateKey, type DailyHabitRecord } from '@/utils/analytics'

// TS DOM lib's NotificationOptions type is missing 'vibrate' even though it's
// a valid runtime property in Chromium browsers. Extend instead of using `any`.
type NotificationOptionsWithVibrate = NotificationOptions & { vibrate?: number[] }

function getHabitTimeMinutes(time: string | undefined) {
  if (!time) return Number.POSITIVE_INFINITY
  const match = time.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return Number.POSITIVE_INFINITY

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return Number.POSITIVE_INFINITY
  }

  return hours * 60 + minutes
}


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
  } = useHabitContext()
  const { isAuthenticated, isLoading: authLoading, user } = useAuth()
  const { snapshot: analyticsSnapshot } = useAnalyticsSnapshot()
  const router = useRouter()

  const [clientReady, setClientReady] = useState(false);

  const [notificationPermission, setNotificationPermission] = useState< "default" | "denied" | "granted" | "unsupported">("unsupported");
  const [notificationTokenRegistered, setNotificationTokenRegistered] = useState(false);
  const [isEnablingNotifications, setIsEnablingNotifications] = useState(false);

  const [selectedWeek, setSelectedWeek] = useState<"all" | 1 | 2 | 3 | 4>("all");

  const todayDay = new Date().getDate();

  const [selectedDay, setSelectedDay] = useState<number>(todayDay);

  const [selectedMatrixYear, setSelectedMatrixYear] = useState<number>(new Date().getFullYear());

  const snapshotYearlyDailyRecords = useMemo(
    () => (analyticsSnapshot ? calculateDailyRecordsForYear(analyticsSnapshot, selectedMatrixYear) : []),
    [analyticsSnapshot, selectedMatrixYear]
  );

  const rollingYearlyDailyRecords = useMemo(() => {
    const today = new Date();
    const yearStart = new Date(selectedMatrixYear, 0, 1);
    const yearEnd = new Date(selectedMatrixYear, 11, 31);
    const records: Array<DailyHabitRecord & { source: 'grid' | 'heatmap' }> = [];
    const oldestHeatmapDiff = -Math.max(0, heatmapData.length - 1);

    for (let cursor = new Date(yearStart); cursor.getTime() <= yearEnd.getTime(); cursor.setDate(cursor.getDate() + 1)) {
      const date = new Date(cursor);
      const diffDays = getDayDiff(date, today);

      if (diffDays > 0) continue;

      if (diffDays >= -29) {
        records.push({
          ...getGridDayStats(gridData, date, today),
          source: 'grid',
        });
        continue;
      }

      if (diffDays >= oldestHeatmapDiff) {
        const heatmapIndex = heatmapData.length - 1 + diffDays;
        const completedCount = heatmapData[heatmapIndex]?.count || 0;

        if (completedCount <= 0) continue;

        records.push({
          date,
          key: toDateKey(date),
          completedCount,
          scheduledCount: gridData.length,
          ratio: gridData.length > 0 ? completedCount / gridData.length : null,
          source: 'heatmap',
        });
      }
    }

    return records;
  }, [gridData, heatmapData, selectedMatrixYear]);

  const yearlyDailyRecords = useMemo(() => {
    const map = new Map<string, DailyHabitRecord>();

    snapshotYearlyDailyRecords.forEach((day) => {
      map.set(day.key, day);
    });

    rollingYearlyDailyRecords.forEach(({ source, ...day }) => {
      const existing = map.get(day.key);
      if (source === 'grid' || !existing || existing.completedCount === 0) {
        map.set(day.key, day);
      }
    });

    return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [snapshotYearlyDailyRecords, rollingYearlyDailyRecords]);

  const dailyRecordByDate = useMemo(() => {
    const map = new Map<string, typeof yearlyDailyRecords[number]>();
    yearlyDailyRecords.forEach((day) => {
      map.set(day.key, day);
    });
    return map;
  }, [yearlyDailyRecords]);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      setClientReady(true);
      if (typeof window !== "undefined" && "Notification" in window) {
        setNotificationPermission(Notification.permission as "default" | "denied" | "granted");
      }
    });

    return () => window.cancelAnimationFrame(id);
  }, []);

  const refreshNotificationHealth = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch('/api/notifications/health-check', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        setNotificationTokenRegistered(Boolean(data.fcmTokenRegistered));
      }
    } catch (error) {
      console.error('Failed to check notification health:', error);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!clientReady || !isAuthenticated) return;

    const id = window.requestAnimationFrame(() => {
      refreshNotificationHealth();
    });
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if ("Notification" in window) {
          setNotificationPermission(Notification.permission as "default" | "denied" | "granted");
        }
        refreshNotificationHealth();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.cancelAnimationFrame(id);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clientReady, isAuthenticated, refreshNotificationHealth]);

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
    if (isAuthenticated && isMounted) {
      let active = true;
      let unsubscribe: (() => void) | undefined;
      getFirebaseMessaging().then(messaging => {
        if (!messaging || !active) return;
        unsubscribe = onMessage(messaging, (payload) => {
          console.log("Foreground push notification received:", payload);
          const title = payload.data?.title || payload.notification?.title || 'HabytFlow Reminder';
          const body = payload.data?.body || payload.notification?.body || '';

          if (Notification.permission === 'granted') {
            navigator.serviceWorker.ready.then(reg => {
              reg.showNotification(title, {
                body,
                icon: '/favicon.ico',
                badge: '/icon-192x192.png',
                vibrate: [200, 100, 200, 100, 200],
              } as NotificationOptionsWithVibrate);
            });
          }
        });
      });
      return () => {
        active = false;
        if (unsubscribe) unsubscribe();
      }
    }
  }, [isAuthenticated, isMounted]);

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
    const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(actualCalendarDay).padStart(2, '0')}`;
    const stats = dailyRecordByDate.get(dateKey);
    
    return {
      day: actualCalendarDay,
      rate: stats?.ratio === null || typeof stats?.ratio === 'undefined' ? null : Math.round((stats.ratio || 0) * 100)
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

  const scheduledHabitsForSelectedDay = gridData
    .filter(habit => habit.frequency ? habit.frequency.includes(dayOfWeekForSelectedDay) : true)
    .map((habit, index) => ({ habit, index }))
    .sort((a, b) => {
      const timeDiff = getHabitTimeMinutes(a.habit.time) - getHabitTimeMinutes(b.habit.time)
      if (timeDiff !== 0) return timeDiff
      return a.index - b.index
    })
    .map(({ habit }) => habit);

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

  const handleEnableNotifications = async () => {
    if (!user?.id || isEnablingNotifications) return;

    setIsEnablingNotifications(true);
    const result = await requestAndStoreNotificationToken(user.id);
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission as "default" | "denied" | "granted");
    }

    if (result.ok) {
      setNotificationTokenRegistered(true);
      toast.success('Habit reminders enabled');
      await refreshNotificationHealth();
    } else if (result.reason === 'permission-denied') {
      toast.error('Notifications are blocked for this browser');
    } else if (result.reason === 'missing-vapid-key') {
      toast.error('Notification setup is missing a VAPID key');
    } else if (result.reason === 'unsupported') {
      toast.error('Notifications are not supported in this browser');
    } else {
      toast.error('Failed to enable notifications');
    }
    setIsEnablingNotifications(false);
  };

  // Selected date string, e.g. "Jun 23"
  const selectedDateStr = dateForSelectedDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const currentYearForMatrix = selectedMatrixYear;

  const yearlyCells = useMemo(() => {
    const jan1 = new Date(currentYearForMatrix, 0, 1);
    const dec31 = new Date(currentYearForMatrix, 11, 31);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstDayOfWeek = jan1.getDay();

    const cells: ({ date: Date; count: number; ratio: number | null; id: string | number } | null)[] =
      Array.from({ length: firstDayOfWeek }, () => null);

    for (let d = new Date(jan1); d <= dec31; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const existing = dailyRecordByDate.get(key);
      cells.push({
        date: new Date(d),
        count: existing ? existing.completedCount : 0,
        ratio: existing?.ratio ?? null,
        id: key,
      });
    }
    return cells;
  }, [dailyRecordByDate, currentYearForMatrix]);

  const yearlyMonthColumns = useMemo(() => {
    const columnCount = Math.ceil(yearlyCells.length / 7);
    const columns: { colIndex: number; monthLabel: string | null }[] = [];
    let lastMonth = -1;

    for (let col = 0; col < columnCount; col++) {
      const rowsInCol = yearlyCells.slice(col * 7, col * 7 + 7);
      const firstRealCell = rowsInCol.find((c) => c !== null);
      let monthLabel: string | null = null;
      if (firstRealCell) {
        const month = firstRealCell.date.getMonth();
        if (month !== lastMonth) {
          monthLabel = firstRealCell.date.toLocaleDateString('en-US', { month: 'short' });
          lastMonth = month;
        }
      }
      columns.push({ colIndex: col, monthLabel });
    }
    return columns;
  }, [yearlyCells]);

  const getHeatmapColor = (ratio: number | null) => {
    if (ratio === null) return "bg-zinc-900";
    if (ratio === 0) return "bg-zinc-900";
    if (ratio <= 0.25) return "bg-green-950";
    if (ratio <= 0.5) return "bg-green-800";
    if (ratio <= 0.75) return "bg-green-600";
    if (ratio > 0.75) return "bg-green-500";
    return "bg-zinc-900";
  };

  // heatmapData is a rolling window ending today (confirmed via
  // habit-context.tsx rollover logic) — NOT anchored to Jan 1st. Month
  // labels and column count must be derived from real dates, not assumed.

  return (
    <>
      <div className={`max-w-250 mx-auto px-6 pt-8 pb-24 space-y-5 ${(authLoading || !isMounted) ? 'opacity-0 h-screen overflow-hidden' : 'opacity-100 transition-opacity duration-300'} text-foreground`}>

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
                className="flex items-center gap-1 border border-border bg-card text-foreground px-2 py-1 text-[9px] md:text-[10px] font-bold tracking-widest uppercase hover:bg-muted transition-colors rounded-xs"
              >
                Back to Today
              </button>
            )}
          </div>
        </div>
        {clientReady && isSelectedDayToday && isAuthenticated && notificationPermission !== 'granted' && (
          <div className="mb-4 flex flex-col gap-3 border border-border bg-card/70 px-4 py-3 text-card-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <Bell size={15} className="mt-0.5 shrink-0 text-zinc-500" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-widest text-foreground">Habit reminders are off</div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">Enable notifications to get timely habit reminders on this device.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleEnableNotifications}
              disabled={isEnablingNotifications}
              className="inline-flex h-9 items-center justify-center border border-border px-3 text-[10px] font-bold uppercase tracking-widest text-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isEnablingNotifications ? 'Enabling...' : 'Enable'}
            </button>
          </div>
        )}
        {clientReady && isSelectedDayToday && isAuthenticated && notificationPermission === 'granted' && !notificationTokenRegistered && (
          <div className="mb-4 flex flex-col gap-3 border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-card-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <Bell size={15} className="mt-0.5 shrink-0 text-amber-600" />
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-widest text-foreground">Finish reminder setup</div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">Permission is granted, but this device needs a fresh reminder token.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleEnableNotifications}
              disabled={isEnablingNotifications}
              className="inline-flex h-9 items-center justify-center border border-amber-500/30 px-3 text-[10px] font-bold uppercase tracking-widest text-amber-700 transition-colors hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isEnablingNotifications ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {gridData.length === 0 && (
            <div className="col-span-full border border-border bg-card p-8 flex flex-col items-center justify-center text-center">
              <h3 className="text-foreground text-lg font-bold uppercase tracking-widest mb-2">No Habits Configured</h3>
              <p className="text-zinc-500 text-sm mb-6">You haven&apos;t set up any habits to track yet.</p>
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
              colorClass = "bg-muted text-zinc-555 border-border opacity-60 grayscale";
            }

            return (
              <button
                key={habit.id}
                onClick={() => handleToggleHabit(habit.id)}
                className={`p-3 md:p-4 flex flex-col justify-between min-h-20 md:min-h-25 border rounded-[1px] transition-all duration-300 transform active:scale-95 text-left ${colorClass}`}
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
              <div className="h-40 min-w-150 w-full -ml-2">
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
                      formatter={(value) => [ `${Number(value ?? 0)}% completed`, "Trend", ]}
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-foreground"> Yearly Matrix </h3>
              <select
                value={selectedMatrixYear}
                onChange={(e) => setSelectedMatrixYear(Number(e.target.value))}
                className="bg-card border border-border text-foreground text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-[1px] focus:outline-none focus:border-foreground cursor-pointer"
              >
                {Array.from({ length: 5 }, (_, i) => 2026 + i).map((yr) => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
          </div>

          <div className="min-w-205">
            {/* Month Labels */}
            <div className="grid grid-flow-col auto-cols-[14px] gap-0.5 ml-8 mb-2 text-[9px] font-bold uppercase tracking-widest text-zinc-500">
              {yearlyMonthColumns.map((col) => (
                <span key={col.colIndex} className="whitespace-nowrap overflow-visible">
                  {col.monthLabel || ''}
                </span>
              ))}
            </div>

            <div className="flex">
              {/* Weekday Labels */}
              <div className="flex flex-col justify-between mr-2 text-[8px] font-bold uppercase tracking-widest text-zinc-500 h-24.5 w-6">
                <span>Mon</span>
                <span>Wed</span>
                <span>Fri</span>
              </div>

              {/* Existing Heatmap */}
              <div className="grid grid-flow-col grid-rows-7 gap-0.5">
                {yearlyCells.map((day, index) => {
                  if (!day) {
                    return <div key={`empty-${index}`} className="w-3.5 h-3.5" />;
                  }
                  return (
                    <div
                      key={day.id}
                      title={`${day.count} completions${day.ratio === null ? '' : ` (${Math.round(day.ratio * 100)}%)`}`}
                      className={[
                        "w-3.5 h-3.5 rounded-[1px] transition-all duration-150 hover:scale-110",
                        getHeatmapColor(day.ratio),
                      ].join(" ")}
                    />
                  );
                })}
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2 mt-3 text-[8px] font-bold uppercase tracking-widest text-zinc-500">
              <span>Less</span>
              <div className="w-3.5 h-3.5 bg-zinc-200 dark:bg-zinc-900 rounded-[1px]" title="Level 0: 0 completions" />
              <div className="w-3.5 h-3.5 bg-green-950 rounded-[1px]" title="Level 1: minimal activity" />
              <div className="w-3.5 h-3.5 bg-green-800 rounded-[1px]" title="Level 2: moderate activity" />
              <div className="w-3.5 h-3.5 bg-green-600 rounded-[1px]" title="Level 3: high activity" />
              <div className="w-3.5 h-3.5 bg-green-500 rounded-[1px]" title="Level 4: maximum activity" />
              <span>More</span>
            </div>
          </div>
        </div>

      </div>
    </>
  )
}
