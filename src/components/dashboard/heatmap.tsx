import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { format, subDays } from 'date-fns'
import { toDateKey } from '@/utils/analytics'

interface HeatmapProps {
  entries: { date: Date; completed: boolean }[]
}

export function Heatmap({ entries }: HeatmapProps) {
  // Generate last 365 days
  const days = Array.from({ length: 365 }).map((_, i) => {
    const d = subDays(new Date(), 364 - i)
    d.setHours(0, 0, 0, 0)
    return d
  })

  // Count completions per day
  const counts = entries.reduce((acc, entry) => {
    if (entry.completed) {
      const key = toDateKey(entry.date)
      acc[key] = (acc[key] || 0) + 1
    }
    return acc
  }, {} as Record<string, number>)

  const getColor = (count: number) => {
    if (count === 0) return 'bg-slate-100 dark:bg-slate-800'
    if (count === 1) return 'bg-emerald-200 dark:bg-emerald-900/40'
    if (count === 2) return 'bg-emerald-400 dark:bg-emerald-700/60'
    return 'bg-emerald-600 dark:bg-emerald-500'
  }

  // Calculate weeks for grid layout
  const weeks: Date[][] = []
  let currentWeek: Date[] = []

  days.forEach((day, i) => {
    // If it's Sunday (0) and not the first day, push the previous week
    if (day.getDay() === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    currentWeek.push(day)
    if (i === days.length - 1) {
      weeks.push(currentWeek)
    }
  })

  return (
    <div className="p-6 bg-white dark:bg-slate-900 rounded-xl border shadow-sm w-full">
      <h3 className="text-lg font-medium mb-4">Contribution Graph</h3>
      <div className="flex gap-1 overflow-x-auto pb-4">
        {weeks.map((week, wIdx) => (
          <div key={wIdx} className="flex flex-col gap-1">
            {/* If the first week doesn't start on Sunday, add empty slots */}
            {wIdx === 0 && week[0].getDay() !== 0 && Array.from({ length: week[0].getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="w-3 h-3" />
            ))}
            {week.map((day, dIdx) => {
              const key = toDateKey(day)
              const count = counts[key] || 0
              return (
                <Tooltip key={dIdx}>
                  <TooltipTrigger className={`w-3 h-3 rounded-sm ${getColor(count)}`} />
                  <TooltipContent>
                    <p>{format(day, 'MMM d, yyyy')}</p>
                    <p className="text-xs text-muted-foreground">{count} Habits Completed</p>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground justify-end">
        <span>Less</span>
        <div className="w-3 h-3 rounded-sm bg-slate-100 dark:bg-slate-800" />
        <div className="w-3 h-3 rounded-sm bg-emerald-200 dark:bg-emerald-900/40" />
        <div className="w-3 h-3 rounded-sm bg-emerald-400 dark:bg-emerald-700/60" />
        <div className="w-3 h-3 rounded-sm bg-emerald-600 dark:bg-emerald-500" />
        <span>More</span>
      </div>
    </div>
  )
}
