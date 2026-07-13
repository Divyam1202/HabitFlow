'use client'

import { useState } from 'react'
import { useHabitStore } from '@/stores/habit-store'
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, getDay } from 'date-fns'
import { DayDetailsModal } from './day-details-modal'
import { MonthSelector } from '@/components/habits/month-selector'

interface HabitEntry {
  date: Date | string
  completed: boolean
}

interface Habit {
  id: string | number
  name: string
  color: string
  entries: HabitEntry[]
}

interface Note {
  date: Date | string
  note: string
}

interface MonthlyCalendarProps {
  habits: Habit[]
  notes: Note[]
}

export function MonthlyCalendar({ habits, notes }: MonthlyCalendarProps) {
  const { activeMonth } = useHabitStore()
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const start = startOfMonth(activeMonth)
  const end = endOfMonth(activeMonth)
  const days = eachDayOfInterval({ start, end })

  // Calculate empty days for the first week
  const startDayOfWeek = getDay(start)
  const emptyDays = Array.from({ length: startDayOfWeek })

  const getDayData = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]

    const completed = habits.filter(h =>
      h.entries.some((e: HabitEntry) => {
        const eDateStr = e.date instanceof Date ? e.date.toISOString().split('T')[0] : new Date(e.date).toISOString().split('T')[0]
        return eDateStr === dateStr && e.completed
      })
    )

    const missed = habits.filter(h => !completed.find(c => c.id === h.id))

    const note = notes.find(n => {
      const nDateStr = n.date instanceof Date ? n.date.toISOString().split('T')[0] : new Date(n.date).toISOString().split('T')[0]
      return nDateStr === dateStr
    })?.note || ''

    return { completedHabits: completed, missedHabits: missed, initialNote: note }
  }

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <MonthSelector />
      </div>

      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="p-3 text-center font-medium text-sm text-muted-foreground">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-[120px]">
          {emptyDays.map((_, i) => (
            <div key={`empty-${i}`} className="border-b border-r bg-muted/10 p-2" />
          ))}

          {days.map(day => {
            const { completedHabits: completed } = getDayData(day)
            const isToday = isSameDay(day, new Date())

            return (
              <div
                key={day.toISOString()}
                className={`border-b border-r p-2 cursor-pointer transition-colors hover:bg-muted/50 overflow-hidden ${isToday ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-muted-foreground'}`}>
                    {format(day, 'd')}
                  </span>
                </div>

                <div className="space-y-1">
                  {completed.slice(0, 3).map(h => (
                    <div key={h.id} className="text-xs truncate flex items-center gap-1 bg-white dark:bg-slate-900 rounded px-1.5 py-0.5 border">
                      <div className={`w-1.5 h-1.5 rounded-full ${h.color} shrink-0`} />
                      {h.name}
                    </div>
                  ))}
                  {completed.length > 3 && (
                    <div className="text-xs text-muted-foreground font-medium pl-2 pt-0.5">
                      +{completed.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedDate && (
        <DayDetailsModal
          date={selectedDate}
          isOpen={!!selectedDate}
          onClose={() => setSelectedDate(null)}
          {...getDayData(selectedDate)}
        />
      )}
    </div>
  )
}
