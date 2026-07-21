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
  BackupState,
  getAutomaticBackups,
  getBackupStatus,
  getLatestBackup,
  createExportPayload,
  createStoredBackupRecord,
  getBackupList,
  getStoredBackups,
  replaceBackupBySource,
  StoredBackupRecord,
} from '@/lib/backup-manager'
import { ClientSettings } from '@/lib/data-import'

function parseState(stateData: unknown) {
  if (typeof stateData !== 'string') return null
  try {
    return JSON.parse(stateData) as Record<string, unknown>
  } catch {
    return null
  }
}

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()

    const stateDoc = await UserState.findOne({ userId: session.user.id }).lean()
    if (!stateDoc?.stateData) {
      return NextResponse.json({
        latestBackup: null,
        automaticBackups: [],
        status: getBackupStatus(null),
        backups: [],
      })
    }

    const parsedState = parseState(stateDoc.stateData)
    if (!parsedState) {
      return NextResponse.json({ error: 'Stored user state is invalid JSON' }, { status: 500 })
    }

    const backups = getBackupList(parsedState as BackupState)
    const storedBackups = getStoredBackups(parsedState as BackupState)
    const latestBackup = getLatestBackup(storedBackups)
    return NextResponse.json({
      latestBackup,
      automaticBackups: getAutomaticBackups(storedBackups, 5),
      status: getBackupStatus(latestBackup),
      backups,
    })
  } catch (error) {
    console.error('Error listing backups:', error)
    return NextResponse.json({ error: 'Failed to list backups' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as {
      name?: string
      clientSettings?: ClientSettings
      source?: 'sync' | 'scheduled' | 'pre-destructive' | 'import-safety' | 'restore-safety'
    }

    await connectToDatabase()

    const stateDoc = await UserState.findOne({ userId: session.user.id }).lean()
    if (!stateDoc?.stateData) {
      return NextResponse.json({ error: 'User state not found' }, { status: 404 })
    }

    const parsedState = parseState(stateDoc.stateData)
    if (!parsedState) {
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

    const payload = createExportPayload({
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
      userState: {
        id: String(stateDoc._id),
        userId: stateDoc.userId,
        timezone: stateDoc.timezone || 'Asia/Kolkata',
        createdAt: stateDoc.createdAt,
        updatedAt: stateDoc.updatedAt,
        stateDataRaw: stateDoc.stateData,
        stateData: parsedState,
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

    const backup = createStoredBackupRecord(payload, body.source || 'sync', body.name)
    const nextState = body.source === 'sync'
      ? replaceBackupBySource(parsedState, backup, 'sync')
      : appendBackupToState(parsedState, backup)

    await UserState.findOneAndUpdate(
      { userId: session.user.id },
      {
        $set: {
          stateData: JSON.stringify(nextState),
          timezone: stateDoc.timezone || 'Asia/Kolkata',
        },
      },
      { upsert: true }
    )

    return NextResponse.json({
      success: true,
      latestBackup: backup,
      automaticBackups: getAutomaticBackups(getStoredBackups(nextState as BackupState), 5),
      status: getBackupStatus(backup),
      backups: getBackupList(nextState as BackupState),
      backup: toPlain({
        id: backup.id,
        name: backup.name,
        createdAt: backup.createdAt,
        updatedAt: backup.updatedAt,
        sizeBytes: backup.sizeBytes,
        source: backup.source,
        summary: backup.payload.userState.summary,
      }),
    })
  } catch (error) {
    console.error('Error creating backup:', error)
    return NextResponse.json({ error: 'Failed to create backup' }, { status: 500 })
  }
}
