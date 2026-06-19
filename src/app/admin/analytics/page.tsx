import { connectToDatabase } from '@/lib/db'
import mongoose from 'mongoose'
import Habit from '@/models/Habit'
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
  const totalHabits = await Habit.countDocuments()
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

  return (
    <div className="p-6 md:p-10 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-foreground font-panchang">
          Product Analytics
        </h1>
        <p className="text-zinc-500 text-xs font-bold tracking-widest uppercase mt-1">
          Performance, signup growth patterns, and active user metrics
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Growth & Usage Section */}
        <div className="space-y-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-2">
            <UserPlus size={16} /> Growth & Acquisition
          </h3>

          <div className="border border-border bg-card text-card-foreground p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-border/40 pb-4">
              <div>
                <p className="text-sm font-bold text-foreground">Daily Signups</p>
                <p className="text-xs text-zinc-500">Past 24 hours</p>
              </div>
              <span className="text-2xl font-black text-foreground">+{signupsDaily}</span>
            </div>
            <div className="flex justify-between items-center border-b border-border/40 pb-4">
              <div>
                <p className="text-sm font-bold text-foreground">Weekly Signups</p>
                <p className="text-xs text-zinc-500">Past 7 days</p>
              </div>
              <span className="text-2xl font-black text-foreground">+{signupsWeekly}</span>
            </div>
            <div className="flex justify-between items-center pb-2">
              <div>
                <p className="text-sm font-bold text-foreground">Monthly Signups</p>
                <p className="text-xs text-zinc-500">Past 30 days</p>
              </div>
              <span className="text-2xl font-black text-foreground">+{signupsMonthly}</span>
            </div>
          </div>

          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 pt-4 mb-2 flex items-center gap-2">
            <Activity size={16} /> User Engagement (Usage)
          </h3>

          <div className="border border-border bg-card text-card-foreground p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-border/40 pb-4">
              <div>
                <p className="text-sm font-bold text-foreground">Daily Active Users (DAU)</p>
                <p className="text-xs text-zinc-500">Active today</p>
              </div>
              <span className="text-2xl font-black text-foreground">{dauCount}</span>
            </div>
            <div className="flex justify-between items-center border-b border-border/40 pb-4">
              <div>
                <p className="text-sm font-bold text-foreground">Weekly Active Users (WAU)</p>
                <p className="text-xs text-zinc-500">Active past 7 days</p>
              </div>
              <span className="text-2xl font-black text-foreground">{wauCount}</span>
            </div>
            <div className="flex justify-between items-center pb-2">
              <div>
                <p className="text-sm font-bold text-foreground">Monthly Active Users (MAU)</p>
                <p className="text-xs text-zinc-500">Active past 30 days</p>
              </div>
              <span className="text-2xl font-black text-foreground">{mauCount}</span>
            </div>
          </div>
        </div>

        {/* Habit Metrics & Retention Section */}
        <div className="space-y-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-2">
            <Flame size={16} /> Habit Engagement Metrics
          </h3>

          <div className="border border-border bg-card text-card-foreground p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-border/40 pb-4">
              <div>
                <p className="text-sm font-bold text-foreground">Average Max Streak</p>
                <p className="text-xs text-zinc-500">Across all user habits</p>
              </div>
              <span className="text-2xl font-black text-foreground">{avgStreak} Days</span>
            </div>
            <div className="flex justify-between items-center border-b border-border/40 pb-4">
              <div>
                <p className="text-sm font-bold text-foreground">Global Completion Rate</p>
                <p className="text-xs text-zinc-500">Completed marks vs scheduled</p>
              </div>
              <span className="text-2xl font-black text-foreground">{completionRate}%</span>
            </div>
            <div className="flex justify-between items-center pb-2">
              <div>
                <p className="text-sm font-bold text-foreground">User Retention Rate</p>
                <p className="text-xs text-zinc-500">MAU relative to total signups</p>
              </div>
              <span className="text-2xl font-black text-foreground">{retentionRate}%</span>
            </div>
          </div>

          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 pt-4 mb-2 flex items-center gap-2">
            <Heart size={16} /> Top Habits Tracked
          </h3>

          <div className="border border-border bg-card text-card-foreground p-6">
            {popularHabitsAgg.length === 0 ? (
              <p className="text-xs text-zinc-500 py-6 text-center font-bold">No telemetry events logged yet</p>
            ) : (
              <div className="space-y-4">
                {popularHabitsAgg.map((habit, i) => (
                  <div key={i} className="flex justify-between items-center border-b border-border/40 pb-3 last:border-0 last:pb-0">
                    <span className="text-sm font-bold text-foreground">
                      {i + 1}. {habit._id || 'Unnamed Habit'}
                    </span>
                    <span className="text-xs font-mono font-bold text-zinc-500">
                      {habit.count} completions
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
