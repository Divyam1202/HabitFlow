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
  buildBackupDownloadPayload,
  buildRestoredStateFromBackup,
  createExportPayload,
  createStoredBackupRecord,
  findBackupById,
  StoredBackupRecord,
} from '@/lib/backup-manager'

function parseState(stateData: unknown) {
  if (typeof stateData !== 'string') return null
  try {
    return JSON.parse(stateData) as Record<string, unknown>
  } catch {
    return null
  }
}

type RestorableModel = {
  deleteMany: (filter: Record<string, unknown>) => Promise<unknown>
  insertMany: (docs: Record<string, unknown>[]) => Promise<unknown>
}

async function restoreCollection(Model: RestorableModel, docs: Record<string, unknown>[], userId: string) {
  await Model.deleteMany({ userId })
  if (docs.length > 0) {
    await Model.insertMany(docs.map((doc) => ({ ...JSON.parse(JSON.stringify(doc)), userId })))
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ backupId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { backupId } = await params
    const body = await req.json().catch(() => ({})) as {
      clientSettings?: {
        timeFormat?: '12h' | '24h'
        theme?: 'system' | 'dark' | 'light'
      }
    }

    await connectToDatabase()

    const stateDoc = await UserState.findOne({ userId: session.user.id }).lean()
    const parsedState = parseState(stateDoc?.stateData)
    if (!parsedState) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 })
    }

    const selectedBackup = findBackupById(parsedState as BackupState, backupId)
    if (!selectedBackup) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 })
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

    const currentPayload = createExportPayload({
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
      userState: {
        id: String(stateDoc?._id || ''),
        userId: session.user.id,
        timezone: stateDoc?.timezone || 'Asia/Kolkata',
        createdAt: stateDoc?.createdAt,
        updatedAt: stateDoc?.updatedAt,
        stateDataRaw: stateDoc?.stateData || JSON.stringify(parsedState),
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

    const safetyBackup = createStoredBackupRecord(currentPayload, 'restore-safety', `Restore Backup ${new Date().toLocaleString()}`)
    const nextBackups = appendBackupToState(parsedState, safetyBackup).backups as StoredBackupRecord[]

    const restoredState = buildRestoredStateFromBackup(selectedBackup, nextBackups)

    try {
      await UserState.findOneAndUpdate(
        { userId: session.user.id },
        {
          $set: {
            stateData: JSON.stringify(restoredState),
            timezone: selectedBackup.payload.userState.timezone || stateDoc?.timezone || 'Asia/Kolkata',
          },
        },
        { upsert: true }
      )

      const restoredRelated = selectedBackup.payload.relatedData
      await restoreCollection(Habit, restoredRelated.legacyHabits, session.user.id)
      await restoreCollection(HabitSchedule, restoredRelated.habitSchedules, session.user.id)
      await restoreCollection(Note, restoredRelated.notes, session.user.id)
      await restoreCollection(DailyMetric, restoredRelated.dailyMetrics, session.user.id)
      await restoreCollection(SportsLog, restoredRelated.sportsLogs, session.user.id)
      await restoreCollection(Notification, restoredRelated.notifications, session.user.id)
      await restoreCollection(NotificationLog, restoredRelated.notificationLogs, session.user.id)

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
        clientSettings: selectedBackup.payload.clientSettings,
        payload: buildBackupDownloadPayload(selectedBackup),
      })
    } catch (error) {
      await UserState.findOneAndUpdate(
        { userId: session.user.id },
        {
          $set: {
            stateData: currentPayload.userState.stateDataRaw,
            timezone: currentPayload.userState.timezone,
          },
        },
        { upsert: true }
      )

      await restoreCollection(Habit, currentPayload.relatedData.legacyHabits, session.user.id)
      await restoreCollection(HabitSchedule, currentPayload.relatedData.habitSchedules, session.user.id)
      await restoreCollection(Note, currentPayload.relatedData.notes, session.user.id)
      await restoreCollection(DailyMetric, currentPayload.relatedData.dailyMetrics, session.user.id)
      await restoreCollection(SportsLog, currentPayload.relatedData.sportsLogs, session.user.id)
      await restoreCollection(Notification, currentPayload.relatedData.notifications, session.user.id)
      await restoreCollection(NotificationLog, currentPayload.relatedData.notificationLogs, session.user.id)
      throw error
    }
  } catch (error) {
    console.error('Error restoring backup:', error)
    return NextResponse.json({ error: 'Failed to restore backup' }, { status: 500 })
  }
}
