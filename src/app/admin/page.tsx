import { connectToDatabase } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import mongoose from 'mongoose'
import HabitSchedule from '@/models/HabitSchedule'
// NOTE: src/models/Habit.ts is dead — no live code path ever writes to it.
// totalCompletions/streak stats below still read from it and are therefore
// meaningless (near-zero) in production. Needs a real fix reading from
// UserState.stateData across all users — separate piece of work, not
// part of the notification migration. Tracked, not solved, here.
import Habit from '@/models/Habit'
import Feedback from '@/models/Feedback'
import AuditLog from '@/models/AuditLog'
import { Users, CheckSquare, Trophy, ShieldAlert, FileText, ArrowUpRight, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !session.user) {
    redirect('/')
  }

  await connectToDatabase()
  const db = mongoose.connection.db
  if (!db) throw new Error("No database connection")

  // --- STATS COMPUTATION ---
  const totalUsers = await db.collection('user').countDocuments()
  
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  
  const newUsersToday = await db.collection('user').countDocuments({
    createdAt: { $gte: todayStart }
  })

  // Active Users Today: Users with active sessions OR user telemetry event today
  const activeSessionsToday = await db.collection('session').countDocuments({
    expiresAt: { $gt: new Date() }
  })
  const activeUsersCount = Math.max(activeSessionsToday, newUsersToday) || 1

  const totalHabits = await HabitSchedule.countDocuments({ active: true })

  // Compute completions from habits history maps
  const allHabits = await Habit.find({}, 'history').lean()
  let totalCompletions = 0
  let totalStreakSum = 0
  
  allHabits.forEach((h: any) => {
    if (h.history) {
      const historyObj = h.history instanceof Map ? Object.fromEntries(h.history) : h.history
      let currentStreak = 0
      let maxCurrentStreak = 0
      
      // Sort history keys (dates) chronologically to evaluate streak
      const sortedDates = Object.keys(historyObj).sort()
      sortedDates.forEach((dateKey) => {
        if (historyObj[dateKey] === true) {
          totalCompletions++
          currentStreak++
          maxCurrentStreak = Math.max(maxCurrentStreak, currentStreak)
        } else {
          currentStreak = 0
        }
      })
      totalStreakSum += maxCurrentStreak
    }
  })

  const averageStreak = totalHabits > 0 ? (totalStreakSum / totalHabits).toFixed(1) : '0'
  const retentionRate = totalUsers > 0 ? ((activeUsersCount / totalUsers) * 100).toFixed(0) : '0'

  // --- LISTS COMPUTATION ---
  const recentSignups = await db.collection('user')
    .find({}, { projection: { name: 1, email: 1, createdAt: 1 } })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray()

  const recentFeedback = await Feedback.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .lean()

  const recentAuditLogs = await AuditLog.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .lean()

  return (
    <div className="p-6 md:p-10 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-foreground font-panchang">
          System Overview
        </h1>
        <p className="text-zinc-500 text-xs font-bold tracking-widest uppercase mt-1">
          HabitFlow System Core Dashboard
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Users */}
        <div className="border border-border bg-card p-6 flex flex-col justify-between text-card-foreground">
          <div className="flex justify-between items-center text-zinc-500 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest">Total Users</span>
            <Users size={16} />
          </div>
          <div>
            <h3 className="text-3xl font-black text-foreground">{totalUsers}</h3>
            <p className="text-xs text-emerald-500 font-bold mt-1">
              +{newUsersToday} Today
            </p>
          </div>
        </div>

        {/* Active Today */}
        <div className="border border-border bg-card p-6 flex flex-col justify-between text-card-foreground">
          <div className="flex justify-between items-center text-zinc-500 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest">Active Users (Today)</span>
            <TrendingUp size={16} />
          </div>
          <div>
            <h3 className="text-3xl font-black text-foreground">{activeUsersCount}</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Based on active sessions
            </p>
          </div>
        </div>

        {/* Total Habits & Completions */}
        <div className="border border-border bg-card p-6 flex flex-col justify-between text-card-foreground">
          <div className="flex justify-between items-center text-zinc-500 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest">Total Habits</span>
            <CheckSquare size={16} />
          </div>
          <div>
            <h3 className="text-3xl font-black text-foreground">{totalHabits}</h3>
            <p className="text-xs text-zinc-500 font-bold mt-1">
              {totalCompletions} Completions
            </p>
          </div>
        </div>

        {/* Streak & Retention */}
        <div className="border border-border bg-card p-6 flex flex-col justify-between text-card-foreground">
          <div className="flex justify-between items-center text-zinc-500 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest">Avg Streak / Retention</span>
            <Trophy size={16} />
          </div>
          <div>
            <h3 className="text-3xl font-black text-foreground">{averageStreak} Days</h3>
            <p className="text-xs text-emerald-500 font-bold mt-1">
              {retentionRate}% user retention
            </p>
          </div>
        </div>
      </div>

      {/* Activity Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Signups */}
        <div className="border border-border bg-card p-6 text-card-foreground flex flex-col justify-between">
          <div className="mb-6 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Recent Signups</h3>
            <Link href="/admin/users" className="text-xs text-zinc-400 hover:text-foreground transition-colors flex items-center gap-1 font-bold">
              All Users <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="space-y-4 flex-grow">
            {recentSignups.map((u, i) => (
              <div key={i} className="flex justify-between items-center border-b border-border/40 pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm font-bold text-foreground">{u.name || 'Anonymous'}</p>
                  <p className="text-xs text-zinc-500">{u.email}</p>
                </div>
                <span className="text-[10px] font-mono text-zinc-650">
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Feedback */}
        <div className="border border-border bg-card p-6 text-card-foreground flex flex-col justify-between">
          <div className="mb-6 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Recent Feedback</h3>
            <Link href="/admin/feedback" className="text-xs text-zinc-400 hover:text-foreground transition-colors flex items-center gap-1 font-bold">
              View Desk <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="space-y-4 flex-grow">
            {recentFeedback.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-6 font-bold">No feedback submitted yet</p>
            ) : (
              recentFeedback.map((f, i) => (
                <div key={i} className="border-b border-border/40 pb-3 last:border-0 last:pb-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[9px] font-mono font-bold tracking-wider px-2 py-0.5 bg-zinc-800 text-zinc-300 uppercase rounded-sm">
                      {f.type.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase">{f.status}</span>
                  </div>
                  <p className="text-sm text-foreground line-clamp-1">{f.message}</p>
                  <p className="text-[10px] text-zinc-500 mt-1 font-semibold">{f.email}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Audit Logs */}
        <div className="border border-border bg-card p-6 text-card-foreground flex flex-col justify-between">
          <div className="mb-6 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Audit Logs</h3>
            <Link href="/admin/audit-logs" className="text-xs text-zinc-400 hover:text-foreground transition-colors flex items-center gap-1 font-bold">
              View Logs <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="space-y-4 flex-grow">
            {recentAuditLogs.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-6 font-bold">No audit entries yet</p>
            ) : (
              recentAuditLogs.map((log, i) => (
                <div key={i} className="border-b border-border/40 pb-3 last:border-0 last:pb-0">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-foreground">{log.action.replace('_', ' ')}</span>
                    <span className="text-[9px] font-mono text-zinc-500">
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 line-clamp-1 mt-0.5">{log.details}</p>
                  <p className="text-[10px] text-zinc-650 mt-1 font-semibold">{log.adminEmail}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}