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
import {
  DataImportBundle,
  ImportStrategy,
  ImportedCompletion,
  ImportedNutritionRecord,
  ImportedSportRecord,
  parseImportText,
  normalizeDateString,
} from '@/lib/data-import'

type StateSnapshot = {
  userStateRaw: string | null
  timezone: string | null
  legacyHabits: Record<string, unknown>[]
  habitSchedules: Record<string, unknown>[]
  notes: Record<string, unknown>[]
  dailyMetrics: Record<string, unknown>[]
  sportsLogs: Record<string, unknown>[]
  notifications: Record<string, unknown>[]
  notificationLogs: Record<string, unknown>[]
}

type ImportBody = {
  fileName?: string
  text?: string
  bundle?: DataImportBundle
  backupPayload?: Record<string, unknown>
  strategy?: ImportStrategy
  clientSettings?: {
    timeFormat?: '12h' | '24h'
    theme?: 'system' | 'dark' | 'light'
  }
}

type StateHabit = {
  id: number
  name: string
  category: string
  time: string
  notification?: number | null
  goal?: string
  streak?: number
  frequency?: number[]
  days: Array<{ day: number; completed: boolean }>
}

type RestorableModel = {
  deleteMany: (filter: Record<string, unknown>) => Promise<unknown>
  insertMany: (docs: Record<string, unknown>[]) => Promise<unknown>
}

function asRecord(value: unknown) {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function stringOrEmpty(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function localDateOffset(baseDate: string, offsetDays: number) {
  const date = new Date(`${baseDate}T00:00:00`)
  date.setDate(date.getDate() + offsetDays)
  return normalizeDateString(date)
}

function snapshotify<T>(docs: T[]): Record<string, unknown>[] {
  return clone(docs as unknown as Record<string, unknown>[])
}

function toRecordArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => isObject(item)) : []
}

function isHabytFlowBackupPayload(value: unknown) {
  return asRecord(value).format === 'habytflow-user-export-v1'
    && asRecord(value).userState
    && asRecord(value).relatedData
}

function getExistingState(stateData: unknown) {
  if (typeof stateData !== 'string') return null
  try {
    return JSON.parse(stateData) as Record<string, unknown>
  } catch {
    return null
  }
}

function buildCompletionRecordsFromGridData(gridData: unknown, baseDate: string): ImportedCompletion[] {
  const records: ImportedCompletion[] = []
  if (!Array.isArray(gridData)) return records

  const anchor = new Date(`${baseDate}T00:00:00`)
  for (const habit of gridData) {
    const item = asRecord(habit)
    const habitName = stringOrEmpty(item.name)
    const days = Array.isArray(item.days) ? item.days : []
    if (!habitName || days.length === 0) continue

    days.forEach((day, index) => {
      const dayRecord = asRecord(day)
      const date = typeof dayRecord.date === 'string'
        ? normalizeDateString(dayRecord.date)
        : (() => {
            const d = new Date(anchor)
            d.setDate(d.getDate() - ((days.length - 1) - index))
            return normalizeDateString(d)
          })()

      if (!date) return
      records.push({
        habitName,
        date,
        completed: !!dayRecord.completed,
        notes: stringOrEmpty(dayRecord.notes) || undefined,
      })
    })
  }

  return records
}

function buildHeatmapMapFromCompletionRecords(records: ImportedCompletion[]) {
  const map = new Map<string, number>()
  for (const record of records) {
    if (!record.completed) continue
    map.set(record.date, (map.get(record.date) || 0) + 1)
  }
  return map
}

function buildStateHabits(
  existingState: Record<string, unknown> | null,
  bundle: DataImportBundle,
  mergedRecords: ImportedCompletion[],
  strategy: ImportStrategy
) {
  const existingGrid = strategy === 'merge' && Array.isArray(existingState?.gridData)
    ? existingState.gridData as unknown[]
    : []

  const habitMap = new Map<string, StateHabit>()
  let nextId = 1

  const ensureHabit = (name: string, meta?: Partial<StateHabit>) => {
    const key = name.trim().toLowerCase()
    const current = habitMap.get(key)
    if (current) {
      habitMap.set(key, {
        ...current,
        category: current.category || meta?.category || 'Imported',
        time: current.time || meta?.time || '09:00',
        frequency: current.frequency?.length ? current.frequency : (meta?.frequency || [0, 1, 2, 3, 4, 5, 6]),
      })
      return current
    }

    const habit: StateHabit = {
      id: meta?.id || nextId++,
      name,
      category: meta?.category || 'Imported',
      time: meta?.time || '09:00',
      frequency: meta?.frequency || [0, 1, 2, 3, 4, 5, 6],
      days: Array.from({ length: 30 }, (_, index) => ({ day: index + 1, completed: false })),
      notification: meta?.notification,
      goal: meta?.goal,
      streak: meta?.streak,
    }
    habitMap.set(key, habit)
    return habit
  }

  for (const habit of existingGrid) {
    const item = asRecord(habit)
    const name = stringOrEmpty(item.name)
    if (!name) continue
    const id = typeof item.id === 'number' ? item.id : nextId++
    if (id >= nextId) nextId = id + 1
    ensureHabit(name, {
      id,
      category: typeof item.category === 'string' ? item.category : 'Imported',
      time: typeof item.time === 'string' ? item.time : '09:00',
      frequency: Array.isArray(item.frequency) ? item.frequency.filter((n) => typeof n === 'number') as number[] : [0, 1, 2, 3, 4, 5, 6],
      notification: item.notification === null || typeof item.notification === 'number' ? item.notification as number | null : undefined,
      goal: typeof item.goal === 'string' ? item.goal : undefined,
      streak: typeof item.streak === 'number' ? item.streak : undefined,
    })
  }

  for (const habit of bundle.habits) {
    ensureHabit(habit.name, {
      category: habit.category || 'Imported',
      time: habit.time || '09:00',
      frequency: habit.frequency || [0, 1, 2, 3, 4, 5, 6],
    })
  }

  for (const record of mergedRecords) {
    ensureHabit(record.habitName)
  }

  return Array.from(habitMap.values()).sort((a, b) => a.id - b.id)
}

function buildGridData(habits: StateHabit[], records: ImportedCompletion[], baseDate: string) {
  const recordMap = new Map<string, Map<string, boolean>>()
  for (const record of records) {
    const habitKey = record.habitName.trim().toLowerCase()
    if (!recordMap.has(habitKey)) recordMap.set(habitKey, new Map())
    recordMap.get(habitKey)!.set(record.date, record.completed)
  }

  return habits.map((habit) => {
    const days = Array.from({ length: 30 }, (_, index) => {
      const date = localDateOffset(baseDate, index - 29)
      const completed = !!date && !!recordMap.get(habit.name.trim().toLowerCase())?.get(date)
      return { day: index + 1, completed }
    })

    return {
      id: habit.id,
      name: habit.name,
      category: habit.category,
      time: habit.time,
      notification: habit.notification,
      goal: habit.goal,
      streak: habit.streak,
      frequency: habit.frequency,
      days,
    }
  })
}

function mergeNotes(existing: Record<string, unknown>[], incoming: DataImportBundle['notes'], strategy: ImportStrategy) {
  const map = new Map<string, Record<string, unknown>>()

  if (strategy === 'merge') {
    for (const note of existing) {
      const item = asRecord(note)
      const key = typeof item.date === 'string' ? item.date : ''
      if (!key) continue
      map.set(key, note)
    }
  }

  if (strategy === 'replace') {
    map.clear()
  }

  for (const note of incoming) {
    const existingNote = map.get(note.date)
    if (!existingNote) {
      map.set(note.date, { date: note.date, content: note.content })
      continue
    }

    const current = asRecord(existingNote)
    const content = typeof current.content === 'string' ? current.content : ''
    if (!content.includes(note.content)) {
      map.set(note.date, {
        ...current,
        content: content ? `${content}\n${note.content}` : note.content,
      })
    }
  }

  return Array.from(map.values()).map((note) => ({ ...asRecord(note), userId: undefined }))
}

function mergeDailyMetrics(existing: Record<string, unknown>[], incoming: ImportedNutritionRecord[], strategy: ImportStrategy) {
  const map = new Map<string, Record<string, unknown>>()

  if (strategy === 'merge') {
    for (const metric of existing) {
      const item = asRecord(metric)
      const key = typeof item.date === 'string' ? item.date : ''
      if (!key) continue
      map.set(key, metric)
    }
  }

  if (strategy === 'replace') {
    map.clear()
  }

  for (const metric of incoming) {
    const existingMetric = map.get(metric.date)
    if (!existingMetric) {
      map.set(metric.date, { ...metric })
      continue
    }

    const current = asRecord(existingMetric)
    map.set(metric.date, {
      ...current,
      hydration: typeof current.hydration === 'number' ? current.hydration : (metric.hydration ?? 0),
      calories: typeof current.calories === 'number' ? current.calories : (metric.calories ?? 0),
      protein: typeof current.protein === 'number' ? current.protein : (metric.protein ?? 0),
      carbs: typeof current.carbs === 'number' ? current.carbs : (metric.carbs ?? 0),
      fat: typeof current.fat === 'number' ? current.fat : (metric.fat ?? 0),
    })
  }

  return Array.from(map.values()).map((metric) => ({ ...asRecord(metric), userId: undefined }))
}

function mergeSportsLogs(existing: Record<string, unknown>[], incoming: ImportedSportRecord[], strategy: ImportStrategy) {
  const map = new Map<string, Record<string, unknown>>()
  const keyFor = (record: Record<string, unknown>) => [
    typeof record.date === 'string' ? record.date : '',
    typeof record.name === 'string' ? record.name.trim().toLowerCase() : '',
    typeof record.durationHours === 'number'
      ? record.durationHours
      : typeof record.duration === 'number'
        ? record.duration
        : 0,
  ].join('|')

  if (strategy === 'merge') {
    for (const sport of existing) {
      const key = keyFor(asRecord(sport))
      if (!key.includes('|')) continue
      map.set(key, sport)
    }
  }

  if (strategy === 'replace') {
    map.clear()
  }

  for (const sport of incoming) {
    const key = [sport.date, sport.name.trim().toLowerCase(), sport.durationHours].join('|')
    if (!map.has(key)) {
      map.set(key, { date: sport.date, name: sport.name, durationHours: sport.durationHours })
    }
  }

  return Array.from(map.values()).map((sport) => ({ ...asRecord(sport), userId: undefined }))
}

function mergeSchedules(
  existing: Record<string, unknown>[],
  habits: StateHabit[],
  strategy: ImportStrategy
) {
  const map = new Map<string, Record<string, unknown>>()

  if (strategy === 'merge') {
    for (const schedule of existing) {
      const item = asRecord(schedule)
      const key = typeof item.habitId === 'string' ? item.habitId : ''
      if (!key) continue
      map.set(key, schedule)
    }
  }

  if (strategy === 'replace') {
    map.clear()
  }

  for (const habit of habits) {
    map.set(String(habit.id), {
      habitId: String(habit.id),
      name: habit.name,
      category: habit.category,
      time: habit.time,
      frequency: habit.frequency || [0, 1, 2, 3, 4, 5, 6],
      timezone: 'Asia/Kolkata',
      offsetMinutes: 0,
      retryEnabled: true,
      pushEnabled: true,
      nextFireAt: null,
      lastFiredKind: null,
      lastFiredAt: null,
      active: true,
    })
  }

  return Array.from(map.values()).map((schedule) => ({ ...asRecord(schedule), userId: undefined }))
}

function mergeRecordsByKey<T extends Record<string, unknown>>(
  existing: T[],
  incoming: T[],
  keyBuilder: (record: T) => string,
  strategy: ImportStrategy
) {
  if (strategy === 'replace') {
    const map = new Map<string, T>()
    for (const record of incoming) {
      const key = keyBuilder(record)
      if (!key) continue
      map.set(key, record)
    }
    return Array.from(map.values())
  }

  const map = new Map<string, T>()
  for (const record of existing) {
    const key = keyBuilder(record)
    if (!key) continue
    map.set(key, record)
  }
  for (const record of incoming) {
    const key = keyBuilder(record)
    if (!key) continue
    map.set(key, record)
  }
  return Array.from(map.values())
}

function buildLegacyHistoryMap(records: ImportedCompletion[]) {
  const historyMap = new Map<string, Record<string, boolean>>()

  for (const record of records) {
    const key = record.habitName.trim().toLowerCase()
    if (!key) continue
    if (!historyMap.has(key)) historyMap.set(key, {})
    historyMap.get(key)![record.date] = record.completed
  }

  return historyMap
}

function buildFallbackLegacyHabits(
  existingLegacyHabits: Record<string, unknown>[],
  habits: StateHabit[],
  mergedRecords: ImportedCompletion[],
  strategy: ImportStrategy
) {
  const historyMap = buildLegacyHistoryMap(mergedRecords)
  const habitDocs = new Map<string, Record<string, unknown>>()

  if (strategy === 'merge') {
    for (const habit of existingLegacyHabits) {
      const item = asRecord(habit)
      const name = stringOrEmpty(item.name)
      if (!name) continue
      habitDocs.set(name.toLowerCase(), habit)
    }
  }

  for (const habit of habits) {
    const key = habit.name.trim().toLowerCase()
    if (!key) continue
    const existing = habitDocs.get(key)
    const history = historyMap.get(key) || (isObject(existing?.history) ? asRecord(existing?.history) : {})

    habitDocs.set(key, {
      ...(existing || {}),
      name: habit.name,
      category: habit.category || stringOrEmpty(existing?.category) || 'Imported',
      history,
    })
  }

  if (strategy === 'replace') {
    return Array.from(habitDocs.values())
  }

  for (const habit of existingLegacyHabits) {
    const item = asRecord(habit)
    const name = stringOrEmpty(item.name)
    if (!name) continue
    if (!habitDocs.has(name.toLowerCase())) {
      habitDocs.set(name.toLowerCase(), habit)
    }
  }

  return Array.from(habitDocs.values())
}

function mergeNotifications(existing: Record<string, unknown>[], incoming: Record<string, unknown>[], strategy: ImportStrategy) {
  if (strategy === 'replace') {
    return incoming.map((item) => ({ ...item, userId: undefined }))
  }

  const map = new Map<string, Record<string, unknown>>()
  for (const entry of existing) {
    const item = asRecord(entry)
    const key = String(item._id || [
      item.userId || '',
      item.habitId || '',
      item.scheduledFor || '',
      item.status || '',
    ].join('|'))
    map.set(key, entry)
  }
  for (const entry of incoming) {
    const item = asRecord(entry)
    const key = String(item._id || [
      item.userId || '',
      item.habitId || '',
      item.scheduledFor || '',
      item.status || '',
    ].join('|'))
    if (!map.has(key)) map.set(key, entry)
  }
  return Array.from(map.values()).map((entry) => ({ ...entry, userId: undefined }))
}

function mergeNotificationLogs(existing: Record<string, unknown>[], incoming: Record<string, unknown>[], strategy: ImportStrategy) {
  if (strategy === 'replace') {
    return incoming.map((item) => ({ ...item, userId: undefined }))
  }

  const map = new Map<string, Record<string, unknown>>()
  for (const entry of existing) {
    const item = asRecord(entry)
    const key = String(item._id || [
      item.userId || '',
      item.habitId || '',
      item.status || '',
      item.createdAt || '',
    ].join('|'))
    map.set(key, entry)
  }
  for (const entry of incoming) {
    const item = asRecord(entry)
    const key = String(item._id || [
      item.userId || '',
      item.habitId || '',
      item.status || '',
      item.createdAt || '',
    ].join('|'))
    if (!map.has(key)) map.set(key, entry)
  }
  return Array.from(map.values()).map((entry) => ({ ...entry, userId: undefined }))
}

function buildStateData(
  existingState: Record<string, unknown> | null,
  bundle: DataImportBundle,
  strategy: ImportStrategy,
  mergedRecords: ImportedCompletion[],
  nextDailyMetrics: Record<string, unknown>[],
  nextSportsLogs: Record<string, unknown>[],
  habits: StateHabit[]
) {
  const today = todayIso()
  const gridData = buildGridData(habits, mergedRecords, today)

  const heatmapCounts = buildHeatmapMapFromCompletionRecords(mergedRecords)
  const heatmapData = Array.from({ length: 364 }, (_, index) => {
    const date = localDateOffset(today, index - 363)
    return { id: index, count: date ? (heatmapCounts.get(date) || 0) : 0 }
  })
  const firstImportedCompletion = [...mergedRecords]
    .filter((record) => record.completed && record.date)
    .map((record) => record.date)
    .sort()[0] || null

  const todaysNutrition = nextDailyMetrics.find((metric) => asRecord(metric).date === today)
  const existingNutrition = asRecord(existingState?.todayNutrition || {})
  const todaysActivityLogs = nextSportsLogs
    .filter((record) => asRecord(record).date === today)
    .map((record, index) => {
      const item = asRecord(record)
      return {
        id: `${item.date || today}-${index}`,
        name: typeof item.name === 'string' ? item.name : 'Activity',
        duration: typeof item.durationHours === 'number'
          ? item.durationHours
          : typeof item.duration === 'number'
            ? item.duration
            : 0,
      }
    })

  const preservedUnknown = strategy === 'replace'
    ? asRecord(bundle.rawStateData || {})
    : { ...asRecord(existingState || {}), ...asRecord(bundle.rawStateData || {}) }

  delete preservedUnknown.gridData
  delete preservedUnknown.heatmapData
  delete preservedUnknown.todayHabits
  delete preservedUnknown.todayNutrition
  delete preservedUnknown.todayActivity
  delete preservedUnknown.currentSystemDate

  const trackingStartedAt = stringOrEmpty(preservedUnknown.trackingStartedAt)
    || firstImportedCompletion
    || today

  return {
    ...preservedUnknown,
    currentSystemDate: today,
    trackingStartedAt,
    todayHabits: gridData
      .filter((habit) => habit.days[habit.days.length - 1]?.completed)
      .map((habit) => habit.id),
    todayNutrition: todaysNutrition
      ? {
          hydration: typeof asRecord(todaysNutrition).hydration === 'number' ? asRecord(todaysNutrition).hydration : 0,
          hydrationGoal: typeof existingNutrition.hydrationGoal === 'number' ? existingNutrition.hydrationGoal : 2500,
          calories: typeof asRecord(todaysNutrition).calories === 'number' ? asRecord(todaysNutrition).calories : 0,
          caloriesGoal: typeof existingNutrition.caloriesGoal === 'number' ? existingNutrition.caloriesGoal : 2000,
          protein: typeof asRecord(todaysNutrition).protein === 'number' ? asRecord(todaysNutrition).protein : 0,
          proteinGoal: typeof existingNutrition.proteinGoal === 'number' ? existingNutrition.proteinGoal : 150,
          carbs: typeof asRecord(todaysNutrition).carbs === 'number' ? asRecord(todaysNutrition).carbs : 0,
          carbsGoal: typeof existingNutrition.carbsGoal === 'number' ? existingNutrition.carbsGoal : 250,
        }
      : (strategy === 'merge' ? existingNutrition : {
          hydration: 0,
          hydrationGoal: 2500,
          calories: 0,
          caloriesGoal: 2000,
          protein: 0,
          proteinGoal: 150,
          carbs: 0,
          carbsGoal: 250,
        }),
    todayActivity: {
      activeMetric: todaysActivityLogs.length > 0 ? 'sports' : null,
      sportsLog: todaysActivityLogs,
      hrAverage: typeof asRecord(existingState?.todayActivity || {}).hrAverage === 'number'
        ? asRecord(existingState?.todayActivity || {}).hrAverage
        : null,
    },
    gridData,
    heatmapData,
  }
}

async function restoreSnapshot(snapshot: StateSnapshot, userId: string) {
  if (snapshot.userStateRaw) {
    await UserState.findOneAndUpdate(
      { userId },
      {
        $set: {
          stateData: snapshot.userStateRaw,
          timezone: snapshot.timezone || 'Asia/Kolkata',
        },
      },
      { upsert: true }
    )
  } else {
    await UserState.deleteOne({ userId })
  }

  const restoreCollection = async (Model: RestorableModel, docs: Record<string, unknown>[]) => {
    await Model.deleteMany({ userId })
    if (docs.length > 0) {
      await Model.insertMany(docs.map((doc) => ({ ...clone(doc), userId })))
    }
  }

  await restoreCollection(Habit, snapshot.legacyHabits)
  await restoreCollection(HabitSchedule, snapshot.habitSchedules)
  await restoreCollection(Note, snapshot.notes)
  await restoreCollection(DailyMetric, snapshot.dailyMetrics)
  await restoreCollection(SportsLog, snapshot.sportsLogs)
  await restoreCollection(Notification, snapshot.notifications)
  await restoreCollection(NotificationLog, snapshot.notificationLogs)
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as ImportBody
    const strategy = body.strategy
    if (strategy !== 'merge' && strategy !== 'replace') {
      return NextResponse.json({ error: 'Invalid import strategy' }, { status: 400 })
    }

    await connectToDatabase()

    const stateDoc = await UserState.findOne({ userId: session.user.id }).lean()
    const existingState = getExistingState(stateDoc?.stateData)

    const currentSnapshot: StateSnapshot = {
      userStateRaw: stateDoc?.stateData || null,
      timezone: stateDoc?.timezone || 'Asia/Kolkata',
      legacyHabits: snapshotify(await Habit.find({ userId: session.user.id }).lean()),
      habitSchedules: snapshotify(await HabitSchedule.find({ userId: session.user.id }).lean()),
      notes: snapshotify(await Note.find({ userId: session.user.id }).lean()),
      dailyMetrics: snapshotify(await DailyMetric.find({ userId: session.user.id }).lean()),
      sportsLogs: snapshotify(await SportsLog.find({ userId: session.user.id }).lean()),
      notifications: snapshotify(await Notification.find({ userId: session.user.id }).lean()),
      notificationLogs: snapshotify(await NotificationLog.find({ userId: session.user.id }).lean()),
    }

    if (strategy === 'replace' && isHabytFlowBackupPayload(body.backupPayload)) {
      const backupPayload = body.backupPayload as Record<string, unknown>
      const payloadUserState = asRecord(backupPayload.userState)
      const payloadRelatedData = asRecord(backupPayload.relatedData)
      const restoredState = isObject(payloadUserState.stateData)
        ? payloadUserState.stateData
        : typeof payloadUserState.stateData === 'string'
          ? (() => {
              try {
                return JSON.parse(payloadUserState.stateData)
              } catch {
                return {}
              }
            })()
          : {}

      const safetyPayload = createExportPayload({
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
          stateDataRaw: stateDoc?.stateData || JSON.stringify(existingState || {}),
          stateData: existingState || {},
        },
        relatedData: {
          legacyHabits: currentSnapshot.legacyHabits,
          habitSchedules: currentSnapshot.habitSchedules,
          notes: currentSnapshot.notes,
          dailyMetrics: currentSnapshot.dailyMetrics,
          sportsLogs: currentSnapshot.sportsLogs,
          notifications: currentSnapshot.notifications,
          notificationLogs: currentSnapshot.notificationLogs,
        },
        clientSettings: body.clientSettings,
      })

      const safetyBackup = createStoredBackupRecord(safetyPayload, 'import-safety', `Import Backup ${new Date().toLocaleString()}`)
      const nextStateWithBackup = appendBackupToState(restoredState, safetyBackup)
      const nextTimezone = typeof payloadUserState.timezone === 'string'
        ? payloadUserState.timezone
        : currentSnapshot.timezone || 'Asia/Kolkata'

      const restoreArray = async (Model: RestorableModel, docs: Record<string, unknown>[]) => {
        await Model.deleteMany({ userId: session.user.id })
        if (docs.length > 0) {
          await Model.insertMany(docs.map((doc) => ({ ...clone(doc), userId: session.user.id })))
        }
      }

      try {
        await UserState.findOneAndUpdate(
          { userId: session.user.id },
          {
            $set: {
              stateData: JSON.stringify(nextStateWithBackup),
              timezone: nextTimezone,
            },
          },
          { upsert: true }
        )

        await restoreArray(Habit, toRecordArray(payloadRelatedData.legacyHabits))
        await restoreArray(HabitSchedule, toRecordArray(payloadRelatedData.habitSchedules))
        await restoreArray(Note, toRecordArray(payloadRelatedData.notes))
        await restoreArray(DailyMetric, toRecordArray(payloadRelatedData.dailyMetrics))
        await restoreArray(SportsLog, toRecordArray(payloadRelatedData.sportsLogs))
        await restoreArray(Notification, toRecordArray(payloadRelatedData.notifications))
        await restoreArray(NotificationLog, toRecordArray(payloadRelatedData.notificationLogs))

        return NextResponse.json({
          success: true,
          imported: {
            habits: Array.isArray(payloadRelatedData.legacyHabits) ? payloadRelatedData.legacyHabits.length : 0,
            completions: Array.isArray(asRecord(payloadUserState.stateData).gridData)
              ? (asRecord(payloadUserState.stateData).gridData as unknown[]).length
              : 0,
            nutritionRecords: Array.isArray(payloadRelatedData.dailyMetrics) ? payloadRelatedData.dailyMetrics.length : 0,
            sportsRecords: Array.isArray(payloadRelatedData.sportsLogs) ? payloadRelatedData.sportsLogs.length : 0,
            notes: Array.isArray(payloadRelatedData.notes) ? payloadRelatedData.notes.length : 0,
            duplicateRecords: 0,
            invalidRecords: 0,
          },
          clientSettings: body.clientSettings || backupPayload.clientSettings,
          stateData: nextStateWithBackup,
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
        console.error('Import restore failed, restoring snapshot...', error)
        await restoreSnapshot(currentSnapshot, session.user.id)
        return NextResponse.json({ error: 'Import failed. Previous data restored.' }, { status: 500 })
      }
    }

    let bundle: DataImportBundle
    if (body.bundle) {
      bundle = body.bundle
    } else if (typeof body.fileName === 'string' && typeof body.text === 'string') {
      bundle = parseImportText(body.fileName, body.text)
    } else {
      return NextResponse.json({ error: 'Invalid import payload' }, { status: 400 })
    }

    const safetyPayload = createExportPayload({
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
        stateDataRaw: stateDoc?.stateData || JSON.stringify(existingState || {}),
        stateData: existingState || {},
      },
      relatedData: {
        legacyHabits: currentSnapshot.legacyHabits,
        habitSchedules: currentSnapshot.habitSchedules,
        notes: currentSnapshot.notes,
        dailyMetrics: currentSnapshot.dailyMetrics,
        sportsLogs: currentSnapshot.sportsLogs,
        notifications: currentSnapshot.notifications,
        notificationLogs: currentSnapshot.notificationLogs,
      },
      clientSettings: body.clientSettings,
    })

    const safetyBackup = createStoredBackupRecord(safetyPayload, 'import-safety', `Import Backup ${new Date().toLocaleString()}`)
    currentSnapshot.userStateRaw = JSON.stringify(appendBackupToState(existingState || {}, safetyBackup))

    const existingCompletionRecords = buildCompletionRecordsFromGridData(
      existingState?.gridData || [],
      stringOrEmpty(existingState?.currentSystemDate) || todayIso()
    )

    const mergedRecords = mergeRecordsByKey(
      strategy === 'merge' ? existingCompletionRecords : [],
      bundle.completionRecords,
      (record) => `${record.habitName.trim().toLowerCase()}|${record.date}`,
      strategy
    )

    const nextDailyMetrics = mergeDailyMetrics(currentSnapshot.dailyMetrics, bundle.nutritionRecords, strategy)
    const nextSportsLogs = mergeSportsLogs(currentSnapshot.sportsLogs, bundle.sportsRecords, strategy)
    const nextHabits = buildStateHabits(existingState, bundle, mergedRecords, strategy)
    const nextState = buildStateData(
      existingState,
      bundle,
      strategy,
      mergedRecords,
      nextDailyMetrics,
      nextSportsLogs,
      nextHabits
    )
    const nextStateWithBackup = appendBackupToState(nextState, safetyBackup)
    const nextHabitSchedules = mergeSchedules(currentSnapshot.habitSchedules, nextHabits, strategy)
    const nextNotes = mergeNotes(currentSnapshot.notes, bundle.notes, strategy)
    const nextNotifications = mergeNotifications(currentSnapshot.notifications, bundle.notifications, strategy)
    const nextNotificationLogs = mergeNotificationLogs(currentSnapshot.notificationLogs, bundle.notificationLogs, strategy)

    const nextLegacyHabits = bundle.legacyHabits.length > 0
      ? mergeRecordsByKey(
          strategy === 'replace' ? [] : currentSnapshot.legacyHabits,
          bundle.legacyHabits,
          (record) => String(asRecord(record)._id || stringOrEmpty(asRecord(record).name)).toLowerCase(),
          strategy
        )
      : buildFallbackLegacyHabits(
          strategy === 'replace' ? [] : currentSnapshot.legacyHabits,
          nextHabits,
          mergedRecords,
          strategy
        )

    try {
      await UserState.findOneAndUpdate(
        { userId: session.user.id },
        {
          $set: {
            stateData: JSON.stringify(nextStateWithBackup),
            timezone: stringOrEmpty(bundle.rawStateData?.timezone) || currentSnapshot.timezone || 'Asia/Kolkata',
          },
        },
        { upsert: true }
      )

      await Habit.deleteMany({ userId: session.user.id })
      if (nextLegacyHabits.length > 0) {
        await Habit.insertMany(nextLegacyHabits.map((doc) => ({ ...clone(doc), userId: session.user.id })))
      }

      await HabitSchedule.deleteMany({ userId: session.user.id })
      if (nextHabitSchedules.length > 0) {
        await HabitSchedule.insertMany(nextHabitSchedules.map((doc) => ({ ...clone(doc), userId: session.user.id })))
      }

      await Note.deleteMany({ userId: session.user.id })
      if (nextNotes.length > 0) {
        await Note.insertMany(nextNotes.map((doc) => ({ ...clone(doc), userId: session.user.id })))
      }

      await DailyMetric.deleteMany({ userId: session.user.id })
      if (nextDailyMetrics.length > 0) {
        await DailyMetric.insertMany(nextDailyMetrics.map((doc) => ({ ...clone(doc), userId: session.user.id })))
      }

      await SportsLog.deleteMany({ userId: session.user.id })
      if (nextSportsLogs.length > 0) {
        await SportsLog.insertMany(nextSportsLogs.map((doc) => ({ ...clone(doc), userId: session.user.id })))
      }

      await Notification.deleteMany({ userId: session.user.id })
      if (nextNotifications.length > 0) {
        await Notification.insertMany(nextNotifications.map((doc) => ({ ...clone(doc), userId: session.user.id })))
      }

      await NotificationLog.deleteMany({ userId: session.user.id })
      if (nextNotificationLogs.length > 0) {
        await NotificationLog.insertMany(nextNotificationLogs.map((doc) => ({ ...clone(doc), userId: session.user.id })))
      }

      return NextResponse.json({
        success: true,
        imported: {
          habits: nextHabits.length,
          completions: bundle.completionRecords.filter((record) => record.completed).length,
          nutritionRecords: bundle.nutritionRecords.length,
          sportsRecords: bundle.sportsRecords.length,
          notes: bundle.notes.length,
          duplicateRecords: bundle.duplicateKeys.length,
          invalidRecords: bundle.invalidRecords.length,
        },
        clientSettings: bundle.settings,
        stateData: nextStateWithBackup,
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
      console.error('Import failed, restoring snapshot...', error)
      await restoreSnapshot(currentSnapshot, session.user.id)
      return NextResponse.json({ error: 'Import failed. Previous data restored.' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error importing user data:', error)
    return NextResponse.json({ error: 'Failed to import user data' }, { status: 500 })
  }
}
