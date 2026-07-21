'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Activity, BarChart3, CalendarDays, ChevronDown, Dumbbell, Flame, Key, Loader2, Search, ShieldCheck, Trash2, Users, WalletCards, XCircle } from 'lucide-react'

type User = {
  id: string
  name: string
  email: string
  createdAt: string
  role: string
  status: string
  plan: string
  lastActive: string
}

type DrawerSnapshot = {
  rawState: Record<string, unknown> | null
  totalHabits: number
  currentStreak: number
  longestStreak: number
  completionRate: number
  totalCompletions: number
  topHabit: { name: string; completionRate: number; executions: number } | null
  weakestHabit: { name: string; completionRate: number; executions: number } | null
  longestLapse: number
  hydration: { value: number; goal: number; percent: number }
  calories: { value: number; goal: number; percent: number }
  protein: { value: number; goal: number; percent: number }
  carbs: { value: number; goal: number; percent: number }
  sports: {
    mostPlayed: string
    totalSessions: number
    totalHours: number
    averageDuration: number
  }
  backups: Array<{ id: string; name: string; createdAt: string; source: string; sizeBytes?: number }>
  notesCount: number
  activityTimeline: Array<{
    id: string
    title: string
    subtitle: string
    timestamp: string
    tone: 'neutral' | 'green' | 'amber' | 'red' | 'blue'
  }>
}

const DEFAULT_SNAPSHOT: DrawerSnapshot = {
  rawState: null,
  totalHabits: 0,
  currentStreak: 0,
  longestStreak: 0,
  completionRate: 0,
  totalCompletions: 0,
  topHabit: null,
  weakestHabit: null,
  longestLapse: 0,
  hydration: { value: 0, goal: 0, percent: 0 },
  calories: { value: 0, goal: 0, percent: 0 },
  protein: { value: 0, goal: 0, percent: 0 },
  carbs: { value: 0, goal: 0, percent: 0 },
  sports: { mostPlayed: 'None', totalSessions: 0, totalHours: 0, averageDuration: 0 },
  backups: [],
  notesCount: 0,
  activityTimeline: [],
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function formatDate(value?: string) {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getDayCompletionCount(day: unknown) {
  if (typeof day === 'boolean') return day ? 1 : 0
  const record = asRecord(day)
  if (typeof record.completed === 'boolean') return record.completed ? 1 : 0
  if (typeof record.done === 'boolean') return record.done ? 1 : 0
  return 0
}

function getLongestLapse(days: unknown[]) {
  let longest = 0
  let current = 0

  for (const day of days) {
    const completed = getDayCompletionCount(day) > 0
    if (completed) {
      longest = Math.max(longest, current)
      current = 0
    } else {
      current += 1
    }
  }

  return Math.max(longest, current)
}

function deriveSnapshot(stateData: Record<string, unknown> | null): DrawerSnapshot {
  if (!stateData) return DEFAULT_SNAPSHOT

  const gridData = asArray<Record<string, unknown>>(stateData.gridData)
  const habits = gridData.length > 0 ? gridData : asArray<Record<string, unknown>>(stateData.habits)
  const todayNutrition = asRecord(stateData.todayNutrition)
  const todayActivity = asRecord(stateData.todayActivity)
  const sportsLog = asArray<Record<string, unknown>>(todayActivity.sportsLog || stateData.sportsLog)
  const notes = asArray<Record<string, unknown>>(stateData.notes)
  const backups = asArray<Record<string, unknown>>(stateData.backups)

  const habitSummaries = habits.map((habit) => {
    const days = asArray<any>(habit.days || habit.history)
    const executions = days.reduce((sum, day) => sum + getDayCompletionCount(day), 0)
    const completionRate = days.length > 0 ? Math.round((executions / days.length) * 100) : 0
    return {
      name: String(habit.name || habit.title || 'Unnamed Habit'),
      completionRate,
      executions,
      lapse: getLongestLapse(days),
    }
  })

  const sortedByCompletion = [...habitSummaries].sort((a, b) => b.completionRate - a.completionRate)
  const topHabit = sortedByCompletion[0] || null
  const weakestHabit = [...habitSummaries].sort((a, b) => a.completionRate - b.completionRate)[0] || null
  const longestLapse = habitSummaries.reduce((max, habit) => Math.max(max, habit.lapse), 0)
  const totalCompletions = habitSummaries.reduce((sum, habit) => sum + habit.executions, 0)
  const totalPossible = habitSummaries.reduce((sum, habit) => {
    const habitDays = asArray<any>((gridData.find((item) => String(item.name || item.title || '') === habit.name) || {}).days)
    return sum + habitDays.length
  }, 0)
  const completionRate = totalPossible > 0 ? Math.round((totalCompletions / totalPossible) * 100) : toNumber(stateData.completionRate)

  const nutritionSummary = {
    hydration: {
      value: toNumber(todayNutrition.hydration),
      goal: toNumber(todayNutrition.hydrationGoal),
      percent: 0,
    },
    calories: {
      value: toNumber(todayNutrition.calories),
      goal: toNumber(todayNutrition.caloriesGoal),
      percent: 0,
    },
    protein: {
      value: toNumber(todayNutrition.protein),
      goal: toNumber(todayNutrition.proteinGoal),
      percent: 0,
    },
    carbs: {
      value: toNumber(todayNutrition.carbs),
      goal: toNumber(todayNutrition.carbsGoal),
      percent: 0,
    },
  }

  Object.values(nutritionSummary).forEach((item) => {
    item.percent = item.goal > 0 ? Math.round((item.value / item.goal) * 100) : 0
  })

  const sportTotals = sportsLog.reduce<Record<string, { sessions: number; totalHours: number; totalMinutes: number }>>((acc, entry) => {
    const name = String(entry.sportName || entry.name || entry.title || 'Sport')
    const duration = toNumber(entry.durationMinutes || entry.duration || entry.minutes)
    const hours = toNumber(entry.hours)
    const resolvedHours = hours > 0 ? hours : duration / 60
    const next = acc[name] || { sessions: 0, totalHours: 0, totalMinutes: 0 }
    next.sessions += 1
    next.totalHours += resolvedHours
    next.totalMinutes += duration || resolvedHours * 60
    acc[name] = next
    return acc
  }, {} as Record<string, { sessions: number; totalHours: number; totalMinutes: number }>)

  const sportEntries = Object.entries(sportTotals).sort((a, b) => b[1].sessions - a[1].sessions)
  const mostPlayed = sportEntries[0]?.[0] || 'None'
  const totalSessions = sportsLog.length
  const totalHours = Number(sportEntries.reduce((sum, [, entry]) => sum + entry.totalHours, 0).toFixed(1))
  const averageDuration = totalSessions > 0
    ? Math.round((sportEntries.reduce((sum, [, entry]) => sum + entry.totalMinutes, 0) / totalSessions))
    : 0

  const activityTimeline = [
    ...backups.slice(0, 4).map((backup) => ({
      id: `backup-${backup.id || backup.createdAt}`,
      title: 'Backup created',
      subtitle: String(backup.name || backup.source || 'Automatic backup'),
      timestamp: String(backup.createdAt || ''),
      tone: 'green' as const,
    })),
    ...notes.slice(0, 3).map((note, index) => ({
      id: `note-${index}-${String(note._id || note.id || index)}`,
      title: 'Note saved',
      subtitle: String(note.title || note.content || note.message || 'Captured note'),
      timestamp: String(note.createdAt || note.updatedAt || ''),
      tone: 'blue' as const,
    })),
    ...sportsLog.slice(0, 3).map((entry, index) => ({
      id: `sport-${index}-${String(entry._id || index)}`,
      title: 'Sport logged',
      subtitle: String(entry.sportName || entry.name || 'Workout session'),
      timestamp: String(entry.createdAt || entry.date || ''),
      tone: 'amber' as const,
    })),
  ]
    .filter((item) => item.timestamp)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 8)

  return {
    rawState: stateData,
    totalHabits: habits.length,
    currentStreak: toNumber(stateData.currentStreak || stateData.streak),
    longestStreak: toNumber(stateData.longestStreak || stateData.maxStreak),
    completionRate,
    totalCompletions,
    topHabit,
    weakestHabit,
    longestLapse,
    hydration: nutritionSummary.hydration,
    calories: nutritionSummary.calories,
    protein: nutritionSummary.protein,
    carbs: nutritionSummary.carbs,
    sports: {
      mostPlayed,
      totalSessions,
      totalHours,
      averageDuration,
    },
    backups: backups.map((backup) => ({
      id: String(backup.id || backup.createdAt || Math.random()),
      name: String(backup.name || 'Backup'),
      createdAt: String(backup.createdAt || ''),
      source: String(backup.source || 'manual'),
      sizeBytes: toNumber(backup.sizeBytes),
    })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    notesCount: notes.length,
    activityTimeline,
  }
}

function DrawerSection({
  title,
  children,
  open = true,
}: {
  title: string
  children: React.ReactNode
  open?: boolean
}) {
  return (
    <details className="group rounded-sm bg-white/[0.02] ring-1 ring-white/5" open={open}>
      <summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400 transition-colors group-hover:text-white">
        {title}
      </summary>
      <div className="border-t border-white/5 px-4 py-3">
        {children}
      </div>
    </details>
  )
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionUserId, setActionUserId] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [drawerSnapshot, setDrawerSnapshot] = useState<DrawerSnapshot>(DEFAULT_SNAPSHOT)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (Array.isArray(data.users)) {
        setUsers(data.users)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    if (!selectedUser) return
    const id = window.requestAnimationFrame(() => setDrawerOpen(true))
    return () => window.cancelAnimationFrame(id)
  }, [selectedUser])

  const closeDrawer = () => {
    setDrawerOpen(false)
    window.setTimeout(() => {
      setSelectedUser(null)
      setDrawerSnapshot(DEFAULT_SNAPSHOT)
      setDrawerLoading(false)
    }, 180)
  }

  const handleAction = async (userId: string, action: string, targetRole?: string) => {
    try {
      setActionUserId(userId)
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action, targetRole }),
      })
      const data = await res.json()
      if (data.success) {
        await fetchUsers()
        if (selectedUser?.id === userId) {
          setSelectedUser((prev) => prev ? { ...prev, status: data.status || prev.status, role: data.role || prev.role } : prev)
        }
      } else {
        alert(data.error || 'Action failed')
      }
    } catch (error) {
      console.error(error)
    } finally {
      setActionUserId(null)
    }
  }

  const openDrawer = async (user: User) => {
    setSelectedUser(user)
    setDrawerLoading(true)
    setDrawerSnapshot(DEFAULT_SNAPSHOT)
    try {
      const res = await fetch(`/api/user-state?adminTargetUser=${encodeURIComponent(user.id)}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load user state')
      }
      setDrawerSnapshot(deriveSnapshot(data.parsedState || null))
    } catch (error) {
      console.error(error)
      setDrawerSnapshot(DEFAULT_SNAPSHOT)
    } finally {
      setDrawerLoading(false)
    }
  }

  const filteredUsers = useMemo(() => {
    const query = searchTerm.toLowerCase()
    return users.filter((user) =>
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    )
  }, [searchTerm, users])

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-8 md:px-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-zinc-500">
            User Operations
          </div>
          <h1 className="font-panchang text-2xl font-black uppercase tracking-tight text-foreground md:text-[2rem]">
            Users
          </h1>
          <p className="max-w-2xl text-sm text-zinc-500">
            Browse registered profiles, open live context, and perform admin actions without leaving the console.
          </p>
        </div>

        <div className="relative w-full lg:w-96">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search name or email"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-card/70 py-3 pl-10 pr-4 text-sm text-foreground ring-1 ring-white/5 outline-none transition-colors placeholder:text-zinc-600 focus:ring-white/10"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24 text-zinc-500">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="overflow-hidden bg-card/65 ring-1 ring-white/5">
          <div className="max-h-[72vh] overflow-auto">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur">
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">User</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Joined</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Role</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Plan</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Status</th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-14 text-center text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
                      No users matching criteria
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      onClick={() => openDrawer(user)}
                      className="group cursor-pointer border-b border-white/5 transition-colors hover:bg-white/[0.03]"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center border border-white/5 bg-white/[0.03] text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
                            {(user.name || user.email || 'U')
                              .split(' ')
                              .map((part) => part[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-white">
                              {user.name}
                            </div>
                            <div className="truncate text-xs text-zinc-500">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-zinc-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                          user.role === 'SUPER_ADMIN' ? 'border-red-500/20 text-red-400' :
                          user.role === 'ADMIN' ? 'border-sky-500/20 text-sky-400' :
                          'border-white/10 text-zinc-300'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
                        {user.plan}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                          user.status === 'suspended'
                            ? 'border-amber-500/20 text-amber-400'
                            : 'border-emerald-500/20 text-emerald-400'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={(event) => {
                              event.stopPropagation()
                              openDrawer(user)
                            }}
                            className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 transition-colors hover:text-white"
                          >
                            View
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation()
                              handleAction(user.id, 'SUSPEND')
                            }}
                            disabled={actionUserId === user.id}
                            className={`text-xs font-semibold uppercase tracking-[0.22em] transition-colors ${
                              user.status === 'suspended' ? 'text-emerald-400 hover:text-emerald-300' : 'text-amber-400 hover:text-amber-300'
                            } disabled:opacity-50`}
                          >
                            {user.status === 'suspended' ? 'Activate' : 'Suspend'}
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation()
                              handleAction(user.id, 'DELETE')
                            }}
                            disabled={actionUserId === user.id}
                            className="text-xs font-semibold uppercase tracking-[0.22em] text-red-400 transition-colors hover:text-red-300 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedUser ? (
        <div className={`fixed inset-0 z-50 ${drawerOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
          <div
            className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${drawerOpen ? 'opacity-100' : 'opacity-0'}`}
            onClick={closeDrawer}
          />
          <aside
            className={`absolute right-0 top-0 h-full w-full max-w-xl overflow-auto border-l border-white/5 bg-zinc-950/95 shadow-2xl transition-transform duration-200 ${
              drawerOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/5 px-6 py-5">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">User Profile</div>
                <h2 className="mt-2 truncate font-panchang text-xl font-black uppercase text-white">
                  {selectedUser.name}
                </h2>
                <p className="mt-1 truncate text-sm text-zinc-500">{selectedUser.email}</p>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="border border-white/10 bg-white/[0.03] p-2 text-zinc-400 transition-colors hover:border-white/20 hover:text-white"
                aria-label="Close profile panel"
              >
                <XCircle size={16} />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Habits', value: drawerSnapshot.totalHabits, icon: Users },
                  { label: 'Completion', value: `${drawerSnapshot.completionRate}%`, icon: BarChart3 },
                  { label: 'Current Streak', value: drawerSnapshot.currentStreak, icon: Flame },
                  { label: 'Longest Streak', value: drawerSnapshot.longestStreak, icon: CalendarDays },
                ].map((metric) => {
                  const Icon = metric.icon
                  return (
                    <div key={metric.label} className="relative bg-white/[0.02] p-4 ring-1 ring-white/5">
                      <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                          {metric.label}
                        </span>
                        <Icon size={14} className="text-white/25" />
                      </div>
                      <div className="mt-3 text-2xl font-black text-white">{metric.value}</div>
                    </div>
                  )
                })}
              </div>

              <DrawerSection title="Profile" open>
                <div className="space-y-3 text-sm">
                  <Row label="Status" value={selectedUser.status} />
                  <Row label="Role" value={selectedUser.role} />
                  <Row label="Plan" value={selectedUser.plan} />
                  <Row label="Joined" value={formatDate(selectedUser.createdAt)} />
                  <Row label="Last Active" value={formatDate(selectedUser.lastActive)} />
                </div>
              </DrawerSection>

              <DrawerSection title="Productivity" open>
                {drawerLoading ? (
                  <div className="flex justify-center py-6 text-zinc-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-3 text-sm">
                    <Row label="Total Completions" value={drawerSnapshot.totalCompletions} />
                    <Row label="Completion Rate" value={`${drawerSnapshot.completionRate}%`} />
                    <Row label="Longest Lapse" value={`${drawerSnapshot.longestLapse} days`} />
                    <Row label="Top Habit" value={drawerSnapshot.topHabit ? `${drawerSnapshot.topHabit.name} · ${drawerSnapshot.topHabit.completionRate}%` : 'None'} />
                    <Row label="Weakest Habit" value={drawerSnapshot.weakestHabit ? `${drawerSnapshot.weakestHabit.name} · ${drawerSnapshot.weakestHabit.completionRate}%` : 'None'} />
                  </div>
                )}
              </DrawerSection>

              <DrawerSection title="Analytics" open={false}>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <MiniStat label="Current Streak" value={`${drawerSnapshot.currentStreak}`} />
                  <MiniStat label="Longest Streak" value={`${drawerSnapshot.longestStreak}`} />
                  <MiniStat label="Active Habits" value={`${drawerSnapshot.totalHabits}`} />
                  <MiniStat label="Lapse" value={`${drawerSnapshot.longestLapse}d`} />
                </div>
              </DrawerSection>

              <DrawerSection title="Nutrition" open={false}>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <MiniProgress label="Hydration" value={drawerSnapshot.hydration} unit="ml" />
                  <MiniProgress label="Calories" value={drawerSnapshot.calories} unit="kcal" />
                  <MiniProgress label="Protein" value={drawerSnapshot.protein} unit="g" />
                  <MiniProgress label="Carbs" value={drawerSnapshot.carbs} unit="g" />
                </div>
              </DrawerSection>

              <DrawerSection title="Sports" open={false}>
                <div className="space-y-3 text-sm">
                  <Row label="Most Played" value={drawerSnapshot.sports.mostPlayed} />
                  <Row label="Sessions" value={drawerSnapshot.sports.totalSessions} />
                  <Row label="Hours" value={drawerSnapshot.sports.totalHours} />
                  <Row label="Avg Duration" value={`${drawerSnapshot.sports.averageDuration} min`} />
                </div>
              </DrawerSection>

              <DrawerSection title="Backups" open={false}>
                <div className="space-y-2">
                  {drawerSnapshot.backups.length === 0 ? (
                    <div className="py-3 text-xs uppercase tracking-[0.24em] text-zinc-500">
                      No backups stored
                    </div>
                  ) : (
                    drawerSnapshot.backups.slice(0, 4).map((backup) => (
                      <div key={backup.id} className="flex items-start justify-between gap-3 rounded-sm px-3 py-2 transition-colors hover:bg-white/[0.03]">
                        <div className="min-w-0">
                          <div className="truncate text-sm text-white">{backup.name}</div>
                          <div className="mt-1 text-xs text-zinc-500">{formatDate(backup.createdAt)} · {backup.source}</div>
                        </div>
                        <div className="shrink-0 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                          {backup.sizeBytes ? `${Math.round(backup.sizeBytes / 1024)} KB` : '—'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </DrawerSection>

              <DrawerSection title="Activity Timeline" open>
                <div className="space-y-2">
                  {drawerSnapshot.activityTimeline.length === 0 ? (
                    <div className="py-3 text-xs uppercase tracking-[0.24em] text-zinc-500">
                      No timeline events available
                    </div>
                  ) : (
                    drawerSnapshot.activityTimeline.map((event) => (
                      <div key={event.id} className="flex items-start gap-3 rounded-sm px-3 py-2 transition-colors hover:bg-white/[0.03]">
                        <div className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                          event.tone === 'green' ? 'bg-emerald-400' :
                          event.tone === 'amber' ? 'bg-amber-400' :
                          event.tone === 'red' ? 'bg-red-400' :
                          event.tone === 'blue' ? 'bg-sky-400' : 'bg-zinc-400'
                        }`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="truncate text-sm text-white">{event.title}</div>
                            <div className="shrink-0 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                              {formatDate(event.timestamp)}
                            </div>
                          </div>
                          <div className="mt-1 truncate text-xs text-zinc-500">{event.subtitle}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </DrawerSection>
            </div>

            <div className="border-t border-white/5 px-6 py-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleAction(selectedUser.id, 'RESET_PASSWORD')}
                  className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white transition-colors hover:border-white/20 hover:bg-white/[0.05]"
                >
                  <Key size={14} />
                  Password Reset
                </button>
                <button
                  onClick={() => handleAction(selectedUser.id, 'DELETE')}
                  disabled={actionUserId === selectedUser.id}
                  className="inline-flex items-center gap-2 border border-red-500/20 bg-red-500/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-red-400 transition-colors hover:border-red-500/30 hover:bg-red-500/10 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  Delete User
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-2 last:border-0 last:pb-0">
      <span className="text-xs uppercase tracking-[0.22em] text-zinc-500">{label}</span>
      <span className="truncate text-right text-sm text-white">{value}</span>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.02] p-3 ring-1 ring-white/5">
      <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{label}</div>
      <div className="mt-2 text-lg font-black text-white">{value}</div>
    </div>
  )
}

function MiniProgress({
  label,
  value,
  unit,
}: {
  label: string
  value: { value: number; goal: number; percent: number }
  unit: string
}) {
  return (
    <div className="bg-white/[0.02] p-3 ring-1 ring-white/5">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{label}</div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-white/70">{value.percent}%</div>
      </div>
      <div className="mt-2 text-lg font-black text-white">
        {value.value}
        <span className="ml-1 text-xs font-medium text-zinc-500">{unit}</span>
      </div>
      <div className="mt-2 h-px w-full bg-white/5" />
      <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
        Goal {value.goal || '—'}
      </div>
    </div>
  )
}
