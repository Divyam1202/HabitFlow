import React, { useState } from 'react';

interface HabitTrackerProps {
  habitId: number;
  habitName: string;
  habitCategory: string;
  habitTime: string | null;
  habitColor: string; // e.g., 'bg-[#3b82f6]', 'bg-[#ef4444]'
  completedDays: number[]; 
  totalDays: number;
  onToggleDay: (habitId: number, day: number) => void;
}

export const HabitGridTrend = ({
  habitId,
  habitName,
  habitCategory,
  habitTime,
  habitColor,
  completedDays,
  totalDays = 30, // Default rolling 30 days
  onToggleDay,
}: HabitTrackerProps) => {
  
  // Create an iterable array running from [1, 2, 3, ..., 30]
  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);

  // Get the current day number right now to highlight or track today
  const today = new Date().getDate(); // Note: since our grid is a rolling 30 days, "today" is always day 30.
  // Actually, in the old table, Day 30 is today.
  // Let's check `page.tsx` old table logic:
  // "Calculate consecutive missed days up to the most recent day in the grid window"
  // Actually, our old grid data was just 1-30. Let's assume day 30 is today.
  const todayDay = 30;

  const getRangeString = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (totalDays - 1));
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  const [animatingCells, setAnimatingCells] = useState<Record<number, boolean>>({});

  const handleToggle = (day: number) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
    
    setAnimatingCells(prev => ({ ...prev, [day]: true }));
    setTimeout(() => {
      setAnimatingCells(prev => ({ ...prev, [day]: false }));
    }, 300);

    onToggleDay(habitId, day);
  };

  return (
    <div className="border border-border bg-card p-3 min-[400px]:p-4 md:p-6 flex flex-col justify-between relative group transition-all duration-150 ease-in-out hover:-translate-y-0.5 hover:border-foreground w-full rounded-[1px]">
      {/* Header Info Area */}
      <div className="flex items-start justify-between mb-4 md:mb-6">
        <div>
          <h3 className="text-[10px] min-[400px]:text-[11px] md:text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5 md:gap-2 leading-tight">
            {habitName}
          </h3>
          <p className="text-[9px] min-[400px]:text-[10px] md:text-xs text-zinc-500 mt-0.5 md:mt-1">{habitCategory}</p>
        </div>
        <div className="flex flex-col items-end">
          {habitTime && (
            <span className="text-[9px] min-[400px]:text-[10px] md:text-xs font-bold text-foreground tracking-widest bg-background border border-border px-1.5 py-0.5 rounded-[1px] mb-1 md:mb-2">
              {habitTime}
            </span>
          )}
          <span className="text-[8px] min-[400px]:text-[9px] md:text-xs text-zinc-600 font-bold uppercase tracking-widest mb-0.5 text-right leading-tight">
            {getRangeString()}
          </span>
          <span className="text-[9px] min-[400px]:text-[10px] md:text-xs text-zinc-400 font-bold uppercase tracking-widest text-right leading-tight">
            {completedDays.length}/{totalDays} Days
          </span>
        </div>
      </div>

      {/* 30-Day Trend Matrix Grid */}
      <div className="grid grid-cols-7 gap-1 min-[400px]:gap-1.5 md:gap-2 mb-4 md:mb-6">
        {daysArray.map((day) => {
          // Check if this iteration step matches a completed logged token
          const isDone = completedDays.includes(day);
          const isToday = day === todayDay;
          const isAnimating = animatingCells[day];

          // Calculate actual calendar date for this square
          const dateForDay = new Date();
          dateForDay.setDate(dateForDay.getDate() - (totalDays - day));
          const actualDayOfMonth = dateForDay.getDate();

          return (
            <button
              key={day}
              onClick={() => handleToggle(day)}
              className={`
                relative h-6 min-[400px]:h-7 md:h-8 w-full rounded-[1px] flex items-center justify-center text-[9px] min-[400px]:text-[10px] md:text-xs font-bold transition-all duration-200 select-none cursor-pointer
                ${isAnimating ? 'scale-125 z-10 shadow-[0_0_15px_rgba(255,255,255,0.5)] bg-white text-black rotate-6' : ''}
                ${!isAnimating && isDone 
                  ? `${habitColor} text-black` // Done: Displays Habit Color
                  : !isAnimating ? 'bg-transparent border border-border text-zinc-650 hover:bg-foreground hover:text-background hover:border-foreground' : '' // Unchecked
                }
                ${isToday && !isDone && !isAnimating ? 'border-zinc-500' : ''}
              `}
              title={`${dateForDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${isDone ? '(Completed)' : '(Unchecked)'}`}
            >
              {isDone && !isAnimating ? '' : actualDayOfMonth}
              
              {/* Subtle indicator dot exclusively tracking "Today" if it isn't completed yet */}
              {isToday && !isDone && !isAnimating && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-zinc-500" />
              )}
            </button>
          );
        })}
      </div>
      
      {/* Visual System Footer Legend */}
      <div className="flex items-center gap-3 min-[400px]:gap-4 mt-auto pt-3 min-[400px]:pt-4 border-t border-border text-[8px] min-[400px]:text-[9px] md:text-xs font-bold uppercase tracking-widest text-zinc-650">
        <div className="flex items-center gap-1.5 md:gap-2">
          <div className="h-2 w-2 min-[400px]:h-2.5 min-[400px]:w-2.5 md:h-3 md:w-3 rounded-[1px] border border-border" />
          <span>Missed</span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <div className={`h-2 w-2 min-[400px]:h-2.5 min-[400px]:w-2.5 md:h-3 md:w-3 rounded-[1px] ${habitColor}`} />
          <span>Completed</span>
        </div>
      </div>
    </div>
  );
};
