import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { connectToDatabase } from '@/lib/db'
import UserState from '@/models/UserState'
import Habit from '@/models/Habit'
import HabitSchedule from '@/models/HabitSchedule'
import Note from '@/models/Note'
import DailyMetric from '@/models/DailyMetric'
import SportsLog from '@/models/SportsLog'
import Notification from '@/models/Notification'
import NotificationLog from '@/models/NotificationLog'
import {
  appendBackupToState,
  createExportPayload,
  createStoredBackupRecord,
} from '@/lib/backup-manager'

function getEmptyState() {
  const today = new Date()
  const currentSystemDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  return {
    currentSystemDate,
    todayHabits: [],
    todayNutrition: {
      hydration: 0,
      hydrationGoal: 2500,
      calories: 0,
      caloriesGoal: 2000,
      protein: 0,
      proteinGoal: 150,
      carbs: 0,
      carbsGoal: 250,
    },
    todayActivity: {
      activeMetric: null,
      sportsLog: [],
      hrAverage: null,
    },
    gridData: [],
    heatmapData: Array.from({ length: 364 }, (_, index) => ({ id: index, count: 0 })),
  }
}

async function clearCollection(Model: { deleteMany: (filter: Record<string, unknown>) => Promise<unknown> }, userId: string) {
  await Model.deleteMany({ userId })
}

async function restoreCollection(
  Model: { deleteMany: (filter: Record<string, unknown>) => Promise<unknown>; insertMany: (docs: Record<string, unknown>[]) => Promise<unknown> },
  docs: Record<string, unknown>[],
  userId: string
) {
  await Model.deleteMany({ userId })
  if (docs.length > 0) {
    await Model.insertMany(docs.map((doc) => ({ ...JSON.parse(JSON.stringify(doc)), userId })))
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as {
      clientSettings?: {
        timeFormat?: '12h' | '24h'
        theme?: 'system' | 'dark' | 'light'
      }
    }

    await connectToDatabase()

    const stateDoc = await UserState.findOne({ userId: session.user.id }).lean()
    const currentState = typeof stateDoc?.stateData === 'string'
      ? (() => {
          try {
            return JSON.parse(stateDoc.stateData)
          } catch {
            return {}
          }
        })()
      : {}
    const timezone = stateDoc?.timezone || 'Asia/Kolkata'
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

    const safetyPayload = createExportPayload({
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
      userState: {
        id: String(stateDoc?._id || ''),
        userId: session.user.id,
        timezone,
        createdAt: stateDoc?.createdAt,
        updatedAt: stateDoc?.updatedAt,
        stateDataRaw: stateDoc?.stateData || JSON.stringify(currentState),
        stateData: currentState,
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
      clientSettings: body.clientSettings,
    })
    const safetyBackup = createStoredBackupRecord(safetyPayload, 'pre-destructive', `Reset Backup ${new Date().toLocaleString()}`)
    const rollbackState = appendBackupToState(currentState, safetyBackup)
    const emptyState = getEmptyState()

    await UserState.findOneAndUpdate(
      { userId: session.user.id },
      {
        $set: {
          stateData: JSON.stringify({
            ...emptyState,
            backups: rollbackState.backups,
          }),
          timezone,
        },
      },
      { upsert: true }
    )

    try {
      await Promise.all([
        clearCollection(Habit, session.user.id),
        clearCollection(HabitSchedule, session.user.id),
        clearCollection(Note, session.user.id),
        clearCollection(DailyMetric, session.user.id),
        clearCollection(SportsLog, session.user.id),
        clearCollection(Notification, session.user.id),
        clearCollection(NotificationLog, session.user.id),
      ])
    } catch (error) {
      await UserState.findOneAndUpdate(
        { userId: session.user.id },
        {
          $set: {
            stateData: JSON.stringify(rollbackState),
            timezone,
          },
        },
        { upsert: true }
      )
      await Promise.all([
        restoreCollection(Habit, legacyHabits as Record<string, unknown>[], session.user.id),
        restoreCollection(HabitSchedule, habitSchedules as Record<string, unknown>[], session.user.id),
        restoreCollection(Note, notes as Record<string, unknown>[], session.user.id),
        restoreCollection(DailyMetric, dailyMetrics as Record<string, unknown>[], session.user.id),
        restoreCollection(SportsLog, sportsLogs as Record<string, unknown>[], session.user.id),
        restoreCollection(Notification, notifications as Record<string, unknown>[], session.user.id),
        restoreCollection(NotificationLog, notificationLogs as Record<string, unknown>[], session.user.id),
      ])
      throw error
    }

    return NextResponse.json({
      success: true,
      backup: {
        id: safetyBackup.id,
        name: safetyBackup.name,
        createdAt: safetyBackup.createdAt,
        updatedAt: safetyBackup.updatedAt,
        sizeBytes: safetyBackup.sizeBytes,
        source: safetyBackup.source,
      },
    })
  } catch (error) {
    console.error('Error resetting user data:', error)
    return NextResponse.json({ error: 'Failed to reset user data' }, { status: 500 })
  }
}
