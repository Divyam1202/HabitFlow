import { connectToDatabase } from '@/lib/db'
import mongoose from 'mongoose'
import Habit from '@/models/Habit' // NOTE: dead model, see admin/page.tsx comment. habits.history below is meaningless.
import HabitSchedule from '@/models/HabitSchedule'
import TelemetryEvent from '@/models/TelemetryEvent'
import { Activity, UserPlus, Flame, Heart } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AdminAnalyticsPage() {
  await connectToDatabase()
  const db = mongoose.connection.db
  if (!db) throw new Error("No database connection")

  const now = new Date()
  const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const past7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const past30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // --- GROWTH METRICS ---
  const signupsDaily = await db.collection('user').countDocuments({ createdAt: { $gte: past24h } })
  const signupsWeekly = await db.collection('user').countDocuments({ createdAt: { $gte: past7d } })
  const signupsMonthly = await db.collection('user').countDocuments({ createdAt: { $gte: past30d } })

  // --- USAGE METRICS ---
  // Active sessions in respective ranges
  const dau = await db.collection('session').distinct('userId', { expiresAt: { $gt: now }, updatedAt: { $gte: past24h } })
  const wau = await db.collection('session').distinct('userId', { expiresAt: { $gt: now }, updatedAt: { $gte: past7d } })
  const mau = await db.collection('session').distinct('userId', { expiresAt: { $gt: now }, updatedAt: { $gte: past30d } })

  const dauCount = Math.max(dau.length, signupsDaily) || 1
  const wauCount = Math.max(wau.length, signupsWeekly) || 1
  const mauCount = Math.max(mau.length, signupsMonthly) || 1

  // --- HABIT METRICS & RETENTION ---
  const totalHabits = await HabitSchedule.countDocuments({ active: true })
  const habits = await Habit.find({}, 'history').lean()

  let completionsCount = 0
  let totalStreakSum = 0
  let totalEvaluations = 0

  habits.forEach((h: any) => {
    if (h.history) {
      const historyObj = h.history instanceof Map ? Object.fromEntries(h.history) : h.history
      let currentStreak = 0
      let maxStreak = 0

      const dates = Object.keys(historyObj)
      dates.forEach((date) => {
        totalEvaluations++
        if (historyObj[date] === true) {
          completionsCount++
          currentStreak++
          maxStreak = Math.max(maxStreak, currentStreak)
        } else {
          currentStreak = 0
        }
      })
      totalStreakSum += maxStreak
    }
  })

  const avgStreak = totalHabits > 0 ? (totalStreakSum / totalHabits).toFixed(1) : '0'
  const completionRate = totalEvaluations > 0 ? ((completionsCount / totalEvaluations) * 100).toFixed(1) : '0'

  // Most Popular Habits
  const popularHabitsAgg = await TelemetryEvent.aggregate([
    { $match: { eventType: { $in: ['habit_created', 'habit_completed'] } } },
    { $group: { _id: "$metadata.habitName", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 }
  ])

  // Simple Retention rate computation
  const totalUsers = await db.collection('user').countDocuments()
  const retentionRate = totalUsers > 0 ? ((mauCount / totalUsers) * 100).toFixed(1) : '0'

  const metrics = [
    { label: 'Daily Signups', value: `+${signupsDaily}`, note: 'Past 24 hours', icon: UserPlus, tone: 'green' },
    { label: 'Weekly Signups', value: `+${signupsWeekly}`, note: 'Past 7 days', icon: UserPlus, tone: 'white' },
    { label: 'Monthly Signups', value: `+${signupsMonthly}`, note: 'Past 30 days', icon: UserPlus, tone: 'amber' },
    { label: 'MAU Retention', value: `${retentionRate}%`, note: `Retention against ${totalUsers} signups`, icon: Activity, tone: 'blue' },
    { label: 'Avg Streak', value: `${avgStreak}d`, note: 'Across active habits', icon: Flame, tone: 'green' },
    { label: 'Completion Rate', value: `${completionRate}%`, note: 'Completed vs scheduled', icon: Heart, tone: 'white' },
    { label: 'DAU', value: `${dauCount}`, note: 'Active today', icon: Activity, tone: 'amber' },
    { label: 'WAU', value: `${wauCount}`, note: 'Active past 7 days', icon: Activity, tone: 'blue' },
  ] as const

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-8 md:px-10">
      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-zinc-500">
          Product Analytics
        </div>
        <h1 className="font-panchang text-2xl font-black uppercase tracking-tight text-foreground md:text-[2rem]">
          HabytFlow Operations Analytics
        </h1>
        <p className="max-w-2xl text-sm text-zinc-500">
          Growth, retention, and habit telemetry in a compact operational view.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <div key={metric.label} className="relative overflow-hidden bg-card/65 p-4 ring-1 ring-white/5">
              <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
              <Icon size={16} className="absolute right-4 top-4 text-white/20" />
              <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
                {metric.label}
              </div>
              <div className="mt-4 text-3xl font-black tracking-tight text-white">
                {metric.value}
              </div>
              <div className="mt-2 text-xs text-zinc-500">{metric.note}</div>
            </div>
          )
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="relative overflow-hidden bg-card/65 p-4 ring-1 ring-white/5">
          <div className="absolute inset-x-0 top-0 h-px bg-sky-400/40" />
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
            <UserPlus size={15} /> Growth & Acquisition
          </div>
          <div className="space-y-1">
            {[
              { label: 'Daily Signups', value: `+${signupsDaily}`, sub: 'Past 24 hours' },
              { label: 'Weekly Signups', value: `+${signupsWeekly}`, sub: 'Past 7 days' },
              { label: 'Monthly Signups', value: `+${signupsMonthly}`, sub: 'Past 30 days' },
              { label: 'DAU', value: `${dauCount}`, sub: 'Active today' },
              { label: 'WAU', value: `${wauCount}`, sub: 'Active past 7 days' },
              { label: 'MAU', value: `${mauCount}`, sub: 'Active past 30 days' },
            ].map((item) => (
              <div key={item.label} className="flex items-start justify-between gap-4 rounded-sm px-3 py-3 transition-colors hover:bg-white/3">
                <div>
                  <div className="text-sm text-white">{item.label}</div>
                  <div className="mt-1 text-xs text-zinc-500">{item.sub}</div>
                </div>
                <div className="text-2xl font-black text-white">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative overflow-hidden bg-card/65 p-4 ring-1 ring-white/5">
          <div className="absolute inset-x-0 top-0 h-px bg-emerald-400/40" />
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
            <Heart size={15} /> Top Habits Tracked
          </div>
          {popularHabitsAgg.length === 0 ? (
            <div className="px-4 py-16 text-center text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
              No telemetry events logged yet
            </div>
          ) : (
            <div className="space-y-1">
              {popularHabitsAgg.map((habit, i) => (
                <div key={i} className="flex items-center justify-between gap-4 rounded-sm px-3 py-3 transition-colors hover:bg-white/3">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-white">
                      {i + 1}. {habit._id || 'Unnamed Habit'}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">Telemetry-tracked activity</div>
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
                    {habit.count} completions
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
