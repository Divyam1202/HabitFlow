import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

import { connectToDatabase } from '@/lib/db'
import { auth } from '@/lib/auth'
import UserState from '@/models/UserState'
import Habit from '@/models/Habit'
import HabitSchedule from '@/models/HabitSchedule'
import Note from '@/models/Note'
import DailyMetric from '@/models/DailyMetric'
import SportsLog from '@/models/SportsLog'
import Notification from '@/models/Notification'
import NotificationLog from '@/models/NotificationLog'

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function summarizeState(state: Record<string, unknown> | null) {
  const gridData = Array.isArray(state?.gridData) ? state.gridData : []
  const heatmapData = Array.isArray(state?.heatmapData) ? state.heatmapData : []
  const todayHabits = Array.isArray(state?.todayHabits) ? state.todayHabits : []
  const todayActivity = typeof state?.todayActivity === 'object' && state.todayActivity !== null
    ? state.todayActivity as { sportsLog?: unknown[] }
    : null

  return {
    stateKeys: state ? Object.keys(state) : [],
    habits: gridData.length,
    habitHistoryCells: gridData.reduce((sum, habit) => {
      const days = typeof habit === 'object' && habit !== null && Array.isArray((habit as { days?: unknown[] }).days)
        ? (habit as { days: unknown[] }).days
        : []
      return sum + days.length
    }, 0),
    completedHabitCells: gridData.reduce((sum, habit) => {
      const days = typeof habit === 'object' && habit !== null && Array.isArray((habit as { days?: Array<{ completed?: boolean }> }).days)
        ? (habit as { days: Array<{ completed?: boolean }> }).days
        : []
      return sum + days.filter((day) => day.completed).length
    }, 0),
    heatmapDays: heatmapData.length,
    heatmapNonZeroDays: heatmapData.filter((day) => {
      if (typeof day !== 'object' || day === null) return false
      return ((day as { count?: number }).count || 0) > 0
    }).length,
    heatmapExecutions: heatmapData.reduce((sum, day) => {
      if (typeof day !== 'object' || day === null) return sum
      return sum + ((day as { count?: number }).count || 0)
    }, 0),
    todayHabits: todayHabits.length,
    sportsEntriesToday: Array.isArray(todayActivity?.sportsLog) ? todayActivity.sportsLog.length : 0,
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()

    const userState = await UserState.findOne({ userId: session.user.id }).lean()
    if (!userState?.stateData) {
      return NextResponse.json({ error: 'User state not found' }, { status: 404 })
    }

    let parsedState: Record<string, unknown>
    try {
      parsedState = JSON.parse(userState.stateData)
    } catch {
      return NextResponse.json({ error: 'Stored user state is invalid JSON' }, { status: 500 })
    }

    const [
      legacyHabits,
      habitSchedules,
      notes,
      dailyMetrics,
      sportsLogs,
      notifications,
      notificationLogs,
    ] = await Promise.all([
      Habit.find({ userId: session.user.id }).lean(),
      HabitSchedule.find({ userId: session.user.id }).lean(),
      Note.find({ userId: session.user.id }).lean(),
      DailyMetric.find({ userId: session.user.id }).lean(),
      SportsLog.find({ userId: session.user.id }).lean(),
      Notification.find({ userId: session.user.id }).lean(),
      NotificationLog.find({ userId: session.user.id }).lean(),
    ])

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      format: 'habytflow-user-export-v1',
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
      userState: {
        id: String(userState._id),
        userId: userState.userId,
        timezone: userState.timezone || 'Asia/Kolkata',
        createdAt: userState.createdAt,
        updatedAt: userState.updatedAt,
        stateData: parsedState,
        stateDataRaw: userState.stateData,
        summary: summarizeState(parsedState),
      },
      relatedData: {
        legacyHabits,
        habitSchedules,
        notes,
        dailyMetrics,
        sportsLogs,
        notifications,
        notificationLogs,
      },
    }

    return NextResponse.json(toPlain(exportPayload))
  } catch (error) {
    console.error('Error exporting user data:', error)
    return NextResponse.json({ error: 'Failed to export user data' }, { status: 500 })
  }
}
