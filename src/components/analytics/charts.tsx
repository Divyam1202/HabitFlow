'use client'

import dynamic from 'next/dynamic'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

const DynamicResponsiveContainer = dynamic(
  () => import('recharts').then((mod) => mod.ResponsiveContainer),
  { ssr: false }
)
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format, subDays, eachMonthOfInterval, subMonths } from 'date-fns'

interface HabitEntry {
  date: Date | string
  completed: boolean
}

interface Habit {
  name: string
  entries: HabitEntry[]
}
interface ChartsProps {
  habits: Habit[]
}

const COLORS = ['#10b981', '#6366f1', '#f43f5e', '#f59e0b', '#0ea5e9', '#8b5cf6', '#d946ef', '#14b8a6']

export function AnalyticsCharts({ habits }: ChartsProps) {
  const allEntries = habits.flatMap((h: Habit) => h.entries)



  // 1. Habit Completion Trend (Last 14 days)
  const last14Days = Array.from({ length: 14 }).map((_, i) => {
    const d = subDays(new Date(), 13 - i)
    d.setUTCHours(0, 0, 0, 0)
    return d
  })

  const trendData = last14Days.map(day => {
    const dateStr = day.toISOString().split('T')[0]
    const completedCount = allEntries.filter((e: HabitEntry) => {
      const eDateStr = e.date instanceof Date ? e.date.toISOString().split('T')[0] : new Date(e.date).toISOString().split('T')[0]
      return eDateStr === dateStr && e.completed
    }).length
    return {
      date: format(day, 'MMM d'),
      completed: completedCount
    }
  })

  // 2. Habit Distribution (Total completions per habit)
  const distributionData = habits.map((h: Habit) => {
    return {
      name: h.name,
      value: h.entries.filter((e: HabitEntry) => e.completed).length,
    }
  }).filter(d => d.value > 0)

  // 3. Monthly Progress (Last 6 months)
  const last6Months = eachMonthOfInterval({
    start: subMonths(new Date(), 5),
    end: new Date()
  })

  const monthlyData = last6Months.map(month => {
    const monthStr = format(month, 'yyyy-MM')
    const completedCount = allEntries.filter((e: HabitEntry) => {
      const eDate = e.date instanceof Date ? e.date : new Date(e.date)
      return format(eDate, 'yyyy-MM') === monthStr && e.completed
    }).length
    return {
      month: format(month, 'MMM yyyy'),
      completed: completedCount
    }
  })

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="col-span-1 md:col-span-2 shadow-sm">
        <CardHeader>
          <CardTitle>Habit Completion Trend (Last 14 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-75 w-full">
            <DynamicResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} dy={10} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="completed" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }} />
              </LineChart>
            </DynamicResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Habit Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-75 w-full">
            {distributionData.length > 0 ? (
              <DynamicResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend iconType="circle" />
                </PieChart>
              </DynamicResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                No data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Monthly Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-75 w-full">
            <DynamicResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} dy={10} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </DynamicResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
