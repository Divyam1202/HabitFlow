'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { GridHabit } from '@/contexts/habit-context';
import { getDayDiff, getGridDayStats } from '@/utils/analytics';

interface UnifiedHabitCalendarProps {
  gridData: GridHabit[];
  selectedDay: number;
  onSelectDay: (day: number) => void;
}

export const UnifiedHabitCalendar = ({ gridData, selectedDay, onSelectDay }: UnifiedHabitCalendarProps) => {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const todayDay = new Date().getDate(); // Today's actual calendar day

  const activeHabits = gridData.map(h => h.name);

  const getDayStats = (actualCalendarDay: number) => {
    const dateForThisDay = new Date(currentYear, currentMonth, actualCalendarDay);
    const stats = getGridDayStats(gridData, dateForThisDay);
    const ratio = stats.ratio ?? 0;

    return {
      isDone: stats.scheduledCount > 0 && stats.completedCount === stats.scheduledCount,
      ratio
    };
  };

  const diffDaysVal = (actualCalendarDay: number) => {
    const targetMidnight = new Date(currentYear, currentMonth, actualCalendarDay);
    return getDayDiff(targetMidnight);
  };

  // Generate today string
  const today = new Date();
  const todayString = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="bg-card p-5 md:p-8 flex flex-col justify-between relative group transition-all duration-300 ease-out hover:shadow-xl w-full rounded-3xl border border-border text-card-foreground">
      {/* Header Info Area */}
      <div className="flex items-start justify-between mb-4 md:mb-6">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg md:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Unified Matrix
          </h2>
          <p className="text-[10px] md:text-xs text-zinc-500 font-medium">
            Tracking {activeHabits.length} active habits
          </p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] md:text-xs font-semibold text-foreground bg-background border border-border px-2.5 py-1 rounded-full mb-1.5 md:mb-2">
            Today: {todayString}
          </span>
          <span className="text-[10px] md:text-xs text-zinc-555 font-medium bg-background border border-border px-2.5 py-1 rounded-full">
            {todayDay}/{daysInMonth} Days
          </span>
        </div>
      </div>

      {/* 30-Day Trend Matrix Grid */}
      <div className="grid grid-cols-7 gap-1 min-[400px]:gap-1.5 md:gap-2 mb-4 md:mb-6">
        {daysArray.map((day) => {
          const { isDone, ratio } = getDayStats(day);
          const isToday = day === todayDay;

          // Calculate actual calendar date for this square
          const dateForDay = new Date(currentYear, currentMonth, day);
          const actualDayOfMonth = day;

          const isClickable = diffDaysVal(day) === 0 || diffDaysVal(day) === -1;

          const isSelected = day === selectedDay;

          return (
            <motion.div
              key={day}
              initial={false}
              animate={isDone ? { scale: [0.5, 1] } : { scale: 1 }}
              transition={{ duration: 0.5, type: "spring", bounce: 0.6 }}
              onClick={() => isClickable && onSelectDay(day)}
              className={`
                relative h-7 min-[400px]:h-8 md:h-10 w-full rounded-md flex items-center justify-center text-[10px] md:text-sm font-semibold select-none overflow-hidden
                transition-all duration-300 ease-out
                ${isClickable ? 'cursor-pointer active:scale-95' : 'opacity-40 cursor-not-allowed'}
                ${isDone 
                  ? `bg-green-500 text-black shadow-lg shadow-green-500/20 hover:bg-green-400` // Perfect Day: Modern Green
                  : 'bg-background text-zinc-555 border border-border/30 hover:bg-muted hover:border-foreground/35' // Missed Day: Soft grey
                }
                ${isSelected ? 'ring-2 ring-zinc-550 ring-offset-2 ring-offset-background scale-105 z-10' : ''}
              `}
              title={`${dateForDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${isDone ? '(Perfect Day)' : `(Completion: ${Math.round(ratio * 100)}%)`}`}
            >
              <motion.span
                key="day"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="z-10"
              >
                {actualDayOfMonth}
              </motion.span>
              
              <AnimatePresence>
                {isDone && (
                  <motion.div
                    key="tick"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", bounce: 0.5 }}
                    className="z-10 absolute top-1 right-1 opacity-70"
                  >
                    <Check size={10} strokeWidth={4} />
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Progress Bar for partially completed days */}
              {!isDone && ratio > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${ratio * 100}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="h-full bg-green-500/70" 
                  />
                </div>
              )}

              {/* Subtle indicator dot exclusively tracking "Today" if it isn't completed yet */}
              {isToday && !isDone && ratio === 0 && (
                <span className="absolute top-1 right-1 h-1 w-1 rounded-full bg-zinc-500" />
              )}
            </motion.div>
          );
        })}
      </div>
      
      {/* Visual System Footer Legend */}
      <div className="flex items-center gap-4 mt-auto pt-6 border-t border-border text-[10px] md:text-xs font-medium text-zinc-555">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-background border border-border" />
          <span>Missed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full bg-green-500 shadow-sm shadow-green-500/20`} />
          <span>Completed</span>
        </div>
      </div>
    </div>
  );
};
