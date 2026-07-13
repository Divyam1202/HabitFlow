'use client'

import React, { useEffect, useState } from 'react'
import { useHabitContext } from '@/contexts/habit-context'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'

export default function CalendarPage() {
  const { gridData, heatmapData } = useHabitContext()
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [calendarDate, setCalendarDate] = useState(new Date())

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, isLoading, router])

  const today = new Date()
  const currentMonth = calendarDate.getMonth()
  const currentYear = calendarDate.getFullYear()

  const isCurrentMonthActive = today.getFullYear() === currentYear && today.getMonth() === currentMonth
  const todayDay = isCurrentMonthActive ? today.getDate() : -1

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay()
  // Adjust so Monday is 0 (Mon = 0, Tue = 1 ... Sun = 6)
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate()

  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7
  const days = Array.from({ length: totalCells }).map((_, i) => i - startOffset + 1)

  const getDayStats = (actualCalendarDay: number) => {
    const dateForThisDay = new Date(currentYear, currentMonth, actualCalendarDay);
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const targetMidnight = new Date(currentYear, currentMonth, actualCalendarDay);
    
    const diffTime = targetMidnight.getTime() - todayMidnight.getTime();
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
    
    // Within 30 days window: compute detailed ratio from gridData
    if (diffDays <= 0 && diffDays >= -29) {
      // const relativeDayNum = 30 + diffDays;
      let completedCount = 0;
      let scheduledCount = 0;
      const dayOfWeek = dateForThisDay.getDay();

      for (const habit of gridData) {
        const isScheduled = habit.frequency ? habit.frequency.includes(dayOfWeek) : true;
        if (isScheduled) {
          scheduledCount++;
          const dayIndex = (habit.days?.length || 30) - 1 + diffDays;
          if (habit.days && habit.days[dayIndex]?.completed) {
            completedCount++;
          }
        }
      }
      return scheduledCount > 0 ? (completedCount / scheduledCount) : null;
    }
    
    // Outside 30 days but within 364 days: compute ratio from heatmapData
    if (diffDays < -29 && diffDays >= -363) {
      const heatmapIndex = heatmapData.length - 1 + diffDays;
      const count = heatmapData[heatmapIndex]?.count || 0;
      const totalHabits = gridData.length || 5;
      return count / totalHabits;
    }
    
    return null;
  };


  const getColorClass = (ratio: number | null) => {
    if (ratio === null) return 'text-zinc-500 dark:text-zinc-400 bg-transparent border-border' // No data
    if (ratio === 0) return 'bg-red-500 text-black border-red-600 font-bold'
    if (ratio <= 0.25) return 'bg-orange-500 text-black border-orange-600 font-bold'
    if (ratio <= 0.5) return 'bg-yellow-500 text-black border-yellow-600 font-bold'
    if (ratio <= 0.75) return 'bg-blue-500 text-black border-blue-600 font-bold'
    return 'bg-green-500 text-black border-green-600 font-bold'
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
    <div className="max-w-250 mx-auto px-6 pt-12 pb-24 space-y-8 text-foreground">
      
      {/* Calendar View Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest text-foreground">CALENDAR VIEW</h1>
          <p className="text-zinc-555 mt-2 text-sm font-medium">Monthly overview of all your daily ticks.</p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-2">
          <div className="text-xl font-black uppercase tracking-widest text-foreground font-mono sm:text-right">
            {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>
          <select
            value={`${currentYear}-${currentMonth}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split('-').map(Number)
              setCalendarDate(new Date(y, m, 1))
            }}
            className="text-[10px] font-bold uppercase tracking-widest bg-background border border-border text-zinc-500 hover:text-foreground hover:border-foreground px-2.5 py-1 outline-none cursor-pointer rounded-xs transition-all duration-150 font-mono"
          >
            {(() => {
              const options = []
              // Start from June 2026
              const start = new Date(2026, 5, 1)
              // Show 12 months starting from June 2026 and ahead
              for (let i = 0; i < 12; i++) {
                const optDate = new Date(start.getFullYear(), start.getMonth() + i, 1)
                const val = `${optDate.getFullYear()}-${optDate.getMonth()}`
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


      {/* Calendar Grid */}
      <div className="border border-border bg-card">
        <div className="grid grid-cols-7 border-b border-border">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className="py-4 text-center text-xs font-bold uppercase tracking-widest text-zinc-555 border-r border-border last:border-0">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const isCurrentMonth = day > 0 && day <= daysInMonth
            const displayDay = day > 0 ? (day > daysInMonth ? day - daysInMonth : day) : daysInPrevMonth + day
            
            let cellContent = null
            let outerClass = 'text-zinc-500 dark:text-zinc-400 bg-transparent border-border'

            if (isCurrentMonth) {
              const ratio = getDayStats(day)
              outerClass = getColorClass(ratio)
              const isToday = day === todayDay

              cellContent = (
                <>
                  <div className={`text-sm ${isToday ? 'border-b-2 border-current inline-block' : ''}`}>
                    {displayDay}
                  </div>
                  {ratio !== null && (
                    <div className="mt-4 flex flex-col gap-1 opacity-80">
                      <div className="h-1 w-full bg-black/20 rounded-full overflow-hidden">
                        <div className="h-full bg-black" style={{ width: `${ratio * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-black text-black/80">{Math.round(ratio * 100)}%</span>
                    </div>
                  )}
                </>
              )
            } else {
              cellContent = <div className="text-sm opacity-50">{displayDay}</div>
            }
            

            return (
              <div 
                key={idx} 
                className={`min-h-30 p-4 border-r border-b border-border last:border-r-0 transition-all duration-200 ${outerClass}`}
              >
                {cellContent}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border text-[9px] font-mono uppercase tracking-widest text-zinc-555">
        <div className="flex items-center gap-1">
          <span>Completion Scale:</span>
          <div className="flex items-center gap-1.5 ml-2">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-red-500 rounded-[1px]" /> 0%</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-orange-500 rounded-[1px]" /> 1-25%</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-yellow-500 rounded-[1px]" /> 26-50%</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-500 rounded-[1px]" /> 51-75%</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-green-500 rounded-[1px]" /> 76-100%</span>
          </div>
        </div>
        
        <button 
          onClick={() => setCalendarDate(new Date())}
          className="text-zinc-500 hover:text-foreground transition-all underline decoration-dotted"
        >
          Reset to Current Month
        </button>
      </div>

    </div>
  )
}
