'use client'

import React, { useEffect } from 'react'
import { useHabitContext } from '@/contexts/habit-context'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'

export default function CalendarPage() {
  const { gridData } = useHabitContext()
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, isLoading, router])

  const today = new Date()

  const currentMonth = today.getMonth()

  const currentYear = today.getFullYear()

  const todayDay = today.getDate()

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay()
  // Adjust so Monday is 0
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
    
    if (diffDays <= 0 && diffDays >= -29) {
      const relativeDayNum = 30 + diffDays;
      let completedCount = 0;
      let scheduledCount = 0;
      const dayOfWeek = dateForThisDay.getDay();

      for (const habit of gridData) {
        const isScheduled = habit.frequency ? habit.frequency.includes(dayOfWeek) : true;
        if (isScheduled) {
          scheduledCount++;
          const dayData = habit.days.find(d => d.day === relativeDayNum);
          if (dayData && dayData.completed) {
            completedCount++;
          }
        }
      }
      return scheduledCount > 0 ? (completedCount / scheduledCount) : null;
    }
    return null; // Future or past outside 30 day window
  };

  const getColorClass = (ratio: number | null) => {
    if (ratio === null) return 'text-zinc-700 bg-zinc-950/50' // No data
    if (ratio === 0) return 'text-zinc-500 bg-zinc-950'
    if (ratio === 1) return 'bg-green-500 text-black border-green-600 font-bold'
    if (ratio >= 0.9) return 'bg-blue-500 text-black border-blue-600 font-bold'
    if (ratio >= 0.75) return 'bg-yellow-400 text-black border-yellow-500 font-bold'
    if (ratio >= 0.5) return 'bg-orange-500 text-black border-orange-600 font-bold'
    return 'bg-red-500 text-black border-red-600 font-bold' // Below 50%
  }

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm font-bold uppercase tracking-widest text-zinc-500 animate-pulse">
          Authenticating...
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1000px] mx-auto px-6 pt-12 pb-24 space-y-12">
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-tight">Calendar View</h1>
          <p className="text-zinc-500 mt-2 text-sm">Monthly overview of all your daily ticks.</p>
        </div>
        <div className="text-xl font-bold uppercase tracking-widest text-white">
          {today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
      </div>

      <div className="border border-zinc-800 bg-black">
        <div className="grid grid-cols-7 border-b border-zinc-800">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className="py-4 text-center text-xs font-bold uppercase tracking-widest text-zinc-500 border-r border-zinc-800 last:border-0">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const isCurrentMonth = day > 0 && day <= daysInMonth
            const displayDay = day > 0 ? (day > daysInMonth ? day - daysInMonth : day) : daysInPrevMonth + day
            
            let cellContent = null
            let outerClass = 'text-zinc-700 bg-zinc-950 border-zinc-900'

            if (isCurrentMonth) {
              const ratio = getDayStats(day)
              outerClass = getColorClass(ratio)
              const isToday = day === todayDay

              cellContent = (
                <>
                  <div className={`text-sm ${isToday ? 'border-b-2 border-current inline-block' : ''}`}>
                    {displayDay}
                  </div>
                  {ratio !== null && ratio > 0 && ratio < 1 && (
                    <div className="mt-4 flex flex-col gap-1 opacity-60">
                      <div className="h-1 w-full bg-black/20 rounded-full overflow-hidden">
                        <div className="h-full bg-black" style={{ width: `${ratio * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-black/60">{Math.round(ratio * 100)}%</span>
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
                className={`min-h-[120px] p-4 border-r border-b border-zinc-800 last:border-r-0 transition-colors duration-200 ${outerClass}`}
              >
                {cellContent}
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
