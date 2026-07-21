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
  
  allHabits.forEach((h) => {
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

  const metrics = [
    {
      label: 'Users',
      value: totalUsers,
      delta: `+${newUsersToday} today`,
      icon: Users,
      tone: 'green',
    },
    {
      label: 'Habits',
      value: totalHabits,
      delta: `${totalCompletions} completions`,
      icon: CheckSquare,
      tone: 'white',
    },
    {
      label: 'Active Today',
      value: activeUsersCount,
      delta: 'Active sessions and new signups',
      icon: TrendingUp,
      tone: 'amber',
    },
    {
      label: 'Retention',
      value: `${retentionRate}%`,
      delta: `Avg streak ${averageStreak} days`,
      icon: Trophy,
      tone: 'blue',
    },
  ] as const

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-8 md:px-10">
      <header className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-zinc-500">
          System Overview
        </div>
        <h1 className="font-panchang text-2xl font-black uppercase tracking-tight text-foreground md:text-[2rem]">
          HabytFlow Operations Console
        </h1>
        <p className="max-w-2xl text-sm text-zinc-500">
          Operational visibility for growth, activity, and moderation across the platform.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon
          const toneClasses = {
            green: 'before:bg-emerald-400/70 group-hover:bg-emerald-500/5',
            white: 'before:bg-white/70 group-hover:bg-white/[0.04]',
            amber: 'before:bg-amber-400/70 group-hover:bg-amber-500/5',
            blue: 'before:bg-sky-400/70 group-hover:bg-sky-500/5',
          }[metric.tone]

          return (
            <div
              key={metric.label}
              className={`group relative overflow-hidden bg-card/70 p-4 ring-1 ring-white/5 transition-all duration-150 hover:-translate-y-0.5 hover:ring-white/10 ${toneClasses}`}
            >
              <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
              <div className="absolute right-4 top-4 text-white/15 transition-colors group-hover:text-white/30">
                <Icon size={18} />
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
                {metric.label}
              </div>
              <div className="mt-4 text-3xl font-black tracking-tight text-foreground">
                {metric.value}
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                {metric.delta}
              </div>
            </div>
          )
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="relative overflow-hidden bg-card/65 p-4 ring-1 ring-white/5">
          <div className="absolute inset-x-0 top-0 h-px bg-emerald-400/50" />
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">Recent Signups</h2>
              <p className="mt-1 text-sm text-zinc-500">Newest accounts arriving in the console.</p>
            </div>
            <Link href="/admin/users" className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400 transition-colors hover:text-white">
              All Users <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="space-y-1">
            {recentSignups.length === 0 ? (
              <div className="px-3 py-4 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                No signups yet
              </div>
            ) : (
              recentSignups.map((u, i) => {
                const initials = (u.name || u.email || 'U')
                  .split(' ')
                  .map((part: string) => part[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()

                return (
                  <div key={i} className="group flex items-start gap-3 rounded-sm px-3 py-3 transition-colors hover:bg-white/3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-white/5 bg-white/3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="truncate text-sm font-medium text-white">
                          {u.name || 'Anonymous'}
                        </p>
                        <span className="shrink-0 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-zinc-500">{u.email}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="relative overflow-hidden bg-card/65 p-4 ring-1 ring-white/5">
          <div className="absolute inset-x-0 top-0 h-px bg-sky-400/40" />
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">Recent Feedback</h2>
              <p className="mt-1 text-sm text-zinc-500">Latest product signals from users.</p>
            </div>
            <Link href="/admin/feedback" className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400 transition-colors hover:text-white">
              View Desk <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="space-y-1">
            {recentFeedback.length === 0 ? (
              <div className="px-3 py-4 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                No feedback submitted
              </div>
            ) : (
              recentFeedback.map((f, i) => (
                <div key={i} className="group flex items-start gap-3 rounded-sm px-3 py-3 transition-colors hover:bg-white/3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-white/5 bg-white/3 text-white/65">
                    <FileText size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate text-sm font-medium text-white">
                        {f.message}
                      </p>
                      <span className="shrink-0 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                        {new Date(f.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em]">
                      <span className={`border px-2 py-0.5 ${
                        f.type === 'BUG_REPORT' ? 'border-red-500/20 text-red-400' :
                        f.type === 'FEATURE_REQUEST' ? 'border-sky-500/20 text-sky-400' :
                        'border-white/10 text-zinc-300'
                      }`}>
                        {f.type.replace('_', ' ')}
                      </span>
                      <span className={`border px-2 py-0.5 ${
                        f.status === 'RESOLVED' || f.status === 'CLOSED'
                          ? 'border-emerald-500/20 text-emerald-400'
                          : f.status === 'PLANNED'
                            ? 'border-amber-500/20 text-amber-400'
                            : 'border-white/10 text-zinc-400'
                      }`}>
                        {f.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-xs text-zinc-500">{f.email}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="relative overflow-hidden bg-card/65 p-4 ring-1 ring-white/5">
          <div className="absolute inset-x-0 top-0 h-px bg-amber-400/40" />
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">Audit Logs</h2>
              <p className="mt-1 text-sm text-zinc-500">Recent system events and operator actions.</p>
            </div>
            <Link href="/admin/audit-logs" className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400 transition-colors hover:text-white">
              View Logs <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="space-y-1">
            {recentAuditLogs.length === 0 ? (
              <div className="px-3 py-4 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                No audit entries
              </div>
            ) : (
              recentAuditLogs.map((log, i) => (
                <div key={i} className="group flex items-start gap-3 rounded-sm px-3 py-3 transition-colors hover:bg-white/3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-white/5 bg-white/3 text-white/65">
                    <ShieldAlert size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate text-sm font-medium text-white">
                        {log.action.replaceAll('_', ' ')}
                      </p>
                      <span className="shrink-0 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-zinc-500">{log.details}</p>
                    <p className="mt-2 truncate text-xs uppercase tracking-[0.18em] text-zinc-600">
                      {log.adminEmail}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
