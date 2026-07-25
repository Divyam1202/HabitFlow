import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { connectToDatabase } from '@/lib/db'
import UserState from '@/models/UserState'
import Habit from '@/models/Habit'
import HabitSchedule from '@/models/HabitSchedule'
import Note from '@/models/Note'
import DailyMetric from '@/models/DailyMetric'
import SportsLog from '@/models/SportsLog'
import Notification from '@/models/Notification'
import NotificationLog from '@/models/NotificationLog'
import { isAdminUser } from '@/lib/admin'
import { auth } from '@/lib/auth'
import { dualWriteHabitSchedules } from '@/lib/dual-write-schedule'
import {
  appendBackupToState,
  createExportPayload,
  createStoredBackupRecord,
  getBackupAgeDays,
  getLatestBackup,
  getStoredBackups,
} from '@/lib/backup-manager'

const DEFAULT_PREVIEW_HABIT_NAMES = ['Gym', 'Reading', 'Touch Grass', 'Skincare', 'Digital Detox']

type StateRecord = Record<string, unknown>

type RelatedStateSnapshot = {
  legacyHabits: Record<string, unknown>[]
  habitSchedules: Record<string, unknown>[]
  notes: Record<string, unknown>[]
  dailyMetrics: Record<string, unknown>[]
  sportsLogs: Record<string, unknown>[]
  notifications: Record<string, unknown>[]
  notificationLogs: Record<string, unknown>[]
}

function asRecord(value: unknown): StateRecord {
  return typeof value === 'object' && value !== null ? value as StateRecord : {}
}

function hasNumericValue(value: unknown) {
  return typeof value === 'number' && value > 0
}

function hasTrackedState(state: unknown) {
  const record = asRecord(state)
  const activity = asRecord(record.todayActivity)
  const nutrition = asRecord(record.todayNutrition)
  const gridData = Array.isArray(record.gridData) ? record.gridData : []
  const heatmapData = Array.isArray(record.heatmapData) ? record.heatmapData : []
  const todayHabits = Array.isArray(record.todayHabits) ? record.todayHabits : []
  const legacyHabits = Array.isArray(record.habits) ? record.habits : []
  const sportsLog = Array.isArray(activity.sportsLog) ? activity.sportsLog : []

  return (
    gridData.length > 0 ||
    legacyHabits.length > 0 ||
    heatmapData.some((day) => hasNumericValue(asRecord(day).count)) ||
    todayHabits.length > 0 ||
    sportsLog.length > 0 ||
    hasNumericValue(nutrition.hydration) ||
    hasNumericValue(nutrition.calories) ||
    hasNumericValue(nutrition.protein) ||
    hasNumericValue(nutrition.carbs)
  )
}

function isDefaultPreviewGrid(gridData: unknown) {
  if (!Array.isArray(gridData) || gridData.length !== DEFAULT_PREVIEW_HABIT_NAMES.length) return false
  const names = gridData.map((habit) => asRecord(habit).name)
  return DEFAULT_PREVIEW_HABIT_NAMES.every((name, index) => names[index] === name)
}

function isUnsafeOverwrite(existingState: unknown, incomingState: unknown) {
  if (!existingState) return false
  if (hasTrackedState(existingState) && !hasTrackedState(incomingState)) return true

  const existingGrid = asRecord(existingState).gridData
  const incomingGrid = asRecord(incomingState).gridData
  if (!isDefaultPreviewGrid(existingGrid) && isDefaultPreviewGrid(incomingGrid)) return true

  return false
}

function shouldCreateScheduledBackup(state: StateRecord, latestBackup: ReturnType<typeof getLatestBackup>) {
  if (!hasTrackedState(state)) return false
  const ageDays = getBackupAgeDays(latestBackup)
  return !latestBackup || ageDays === null || ageDays >= 3
}

function toLocalDateKey(value: string | Date | null | undefined) {
  if (!value) return null

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }

  const raw = value.trim()
  if (!raw) return null

  const dateOnly = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (dateOnly) return dateOnly[1]

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
}

function addDaysToDateKey(dateKey: string, offsetDays: number) {
  const date = new Date(`${dateKey}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  date.setDate(date.getDate() + offsetDays)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function asBooleanHistoryMap(history: unknown) {
  const map = new Map<string, boolean>()

  const addEntry = (key: unknown, value: unknown) => {
    const normalizedKey = toLocalDateKey(typeof key === 'string' || key instanceof Date ? key : null)
    if (!normalizedKey) return
    if (value) {
      map.set(normalizedKey, true)
    }
  }

  if (history instanceof Map) {
    for (const [key, value] of history.entries()) addEntry(key, value)
    return map
  }

  if (Array.isArray(history)) {
    for (const entry of history) {
      if (!Array.isArray(entry) || entry.length < 2) continue
      addEntry(entry[0], entry[1])
    }
    return map
  }

  if (history && typeof history === 'object') {
    for (const [key, value] of Object.entries(history as Record<string, unknown>)) {
      addEntry(key, value)
    }
  }

  return map
}

async function syncCanonicalCollectionsFromState(state: StateRecord, userId: string) {
  const currentSystemDate = toLocalDateKey(state.currentSystemDate as string | Date | null | undefined) || toLocalDateKey(new Date()) || ''
  const gridData = Array.isArray(state.gridData)
    ? state.gridData.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item))
    : []
  const currentGridNames = new Set<string>()

  const existingHabits = await Habit.find({ userId }).lean()
  const existingByName = new Map(existingHabits.map((habit) => [stringOrEmpty((habit as Record<string, unknown>).name).toLowerCase(), habit as Record<string, unknown>]))
  const nextHabits: Record<string, unknown>[] = []

  for (const habit of gridData) {
    const name = stringOrEmpty(habit.name)
    if (!name) continue

    const key = name.toLowerCase()
    currentGridNames.add(key)
    const existing = existingByName.get(key)
    const history = asBooleanHistoryMap(existing?.history)
    const days = Array.isArray(habit.days) ? habit.days : []

    days.forEach((day, index) => {
      const dayRecord = typeof day === 'object' && day !== null && !Array.isArray(day) ? day : {}
      const completed = !!dayRecord.completed
      const dateKey = currentSystemDate ? addDaysToDateKey(currentSystemDate, index - (days.length - 1)) : null
      if (!dateKey) return

      if (completed) {
        history.set(dateKey, true)
      } else {
        history.delete(dateKey)
      }
    })

    nextHabits.push({
      ...(existing ? { ...existing } : {}),
      name,
      description: typeof existing?.description === 'string' ? existing.description : undefined,
      category: stringOrEmpty(habit.category) || stringOrEmpty(existing?.category) || 'Imported',
      color: stringOrEmpty(habit.color) || stringOrEmpty(existing?.color) || 'bg-emerald-500',
      history: Object.fromEntries(history.entries()),
    })
  }

  await Habit.deleteMany({ userId })
  if (nextHabits.length > 0) {
    await Habit.insertMany(nextHabits.map((habit) => ({ ...clone(habit), userId })))
  }

  const todayNutrition = typeof state.todayNutrition === 'object' && state.todayNutrition !== null && !Array.isArray(state.todayNutrition)
    ? state.todayNutrition as Record<string, unknown>
    : {}
  const nutritionDate = currentSystemDate
  if (nutritionDate) {
    await DailyMetric.deleteMany({ userId, date: nutritionDate })
    const hasNutrition = ['hydration', 'calories', 'protein', 'carbs', 'fat'].some((key) => typeof todayNutrition[key] === 'number')
    if (hasNutrition) {
      await DailyMetric.create({
        userId,
        date: nutritionDate,
        hydration: typeof todayNutrition.hydration === 'number' ? todayNutrition.hydration : 0,
        calories: typeof todayNutrition.calories === 'number' ? todayNutrition.calories : 0,
        protein: typeof todayNutrition.protein === 'number' ? todayNutrition.protein : 0,
        carbs: typeof todayNutrition.carbs === 'number' ? todayNutrition.carbs : 0,
        fat: typeof todayNutrition.fat === 'number' ? todayNutrition.fat : 0,
      })
    }
  }

  const todayActivity = typeof state.todayActivity === 'object' && state.todayActivity !== null && !Array.isArray(state.todayActivity)
    ? state.todayActivity as Record<string, unknown>
    : {}
  const sportsLog = Array.isArray(todayActivity.sportsLog) ? todayActivity.sportsLog.filter((item): item is Record<string, unknown> => isObject(item)) : []
  if (nutritionDate) {
    await SportsLog.deleteMany({ userId, date: nutritionDate })
    if (sportsLog.length > 0) {
      await SportsLog.insertMany(sportsLog.map((entry) => ({
        userId,
        date: nutritionDate,
        name: stringOrEmpty(entry.name) || 'Activity',
        durationHours: typeof entry.durationHours === 'number'
          ? entry.durationHours
          : typeof entry.duration === 'number'
            ? entry.duration
            : 0,
      })))
    }
  }

  return {
    habitCount: nextHabits.length,
    trackedHabitNames: currentGridNames.size,
    nutritionDate,
    sportsSessions: sportsLog.length,
  }
}

async function buildRelatedStateSnapshot(userId: string): Promise<RelatedStateSnapshot> {
  const [
    legacyHabits,
    habitSchedules,
    notes,
    dailyMetrics,
    sportsLogs,
    notifications,
    notificationLogs,
  ] = await Promise.all([
    Habit.find({ userId }).lean(),
    HabitSchedule.find({ userId }).lean(),
    Note.find({ userId }).lean(),
    DailyMetric.find({ userId }).lean(),
    SportsLog.find({ userId }).lean(),
    Notification.find({ userId }).lean(),
    NotificationLog.find({ userId }).lean(),
  ])

  return {
    legacyHabits,
    habitSchedules,
    notes,
    dailyMetrics,
    sportsLogs,
    notifications,
    notificationLogs,
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()

    const targetUserId = req.nextUrl.searchParams.get('adminTargetUser')
    const isAdminRequest = Boolean(targetUserId && isAdminUser(session.user))
    const userState = await UserState.findOne({ userId: isAdminRequest ? targetUserId : session.user.id })
    
    if (!userState) {
      return NextResponse.json({ stateData: null, timezone: null })
    }
    
    let parsedState: StateRecord | null = null
    let stateDataValue = userState.stateData
    try {
      parsedState = JSON.parse(userState.stateData)
    } catch {
      return NextResponse.json({ error: 'Stored user state is invalid JSON' }, { status: 500 })
    }

    const storedBackups = getStoredBackups(parsedState)
    const latestBackup = getLatestBackup(storedBackups)

    if (!isAdminRequest && parsedState && shouldCreateScheduledBackup(parsedState, latestBackup)) {
      const relatedData = await buildRelatedStateSnapshot(session.user.id)
      const backupPayload = createExportPayload({
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
          stateDataRaw: userState.stateData,
          stateData: parsedState,
        },
        relatedData,
      })
      const scheduledBackup = createStoredBackupRecord(
        backupPayload,
        'scheduled',
        `Automatic Backup ${new Date().toLocaleString()}`
      )
      const nextState = appendBackupToState(parsedState, scheduledBackup)

      await UserState.findOneAndUpdate(
        { userId: session.user.id },
        {
          $set: {
            stateData: JSON.stringify(nextState),
            timezone: userState.timezone || 'Asia/Kolkata',
          },
        },
        { upsert: true }
      )

      parsedState = nextState
      stateDataValue = JSON.stringify(nextState)
    }

    return NextResponse.json({
      stateData: stateDataValue,
      parsedState,
      timezone: userState.timezone || 'Asia/Kolkata',
      createdAt: userState.createdAt,
      updatedAt: userState.updatedAt,
    })
  } catch (error) {
    console.error('Error fetching user state:', error)
    return NextResponse.json({ error: 'Failed to fetch user state' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stateData, timezone, allowReset = false } = await req.json()

    if (!stateData) {
      return NextResponse.json({ error: 'stateData is required' }, { status: 400 })
    }

    let incomingState = null
    try {
      incomingState = JSON.parse(stateData)
    } catch {
      return NextResponse.json({ error: 'stateData must be valid JSON' }, { status: 400 })
    }

    await connectToDatabase()

    const existingStateDoc = await UserState.findOne({ userId: session.user.id })
    if (existingStateDoc?.stateData && !allowReset) {
      let existingState = null
      try {
        existingState = JSON.parse(existingStateDoc.stateData)
      } catch {
        existingState = null
      }

      if (isUnsafeOverwrite(existingState, incomingState)) {
        return NextResponse.json(
          { error: 'Refusing to overwrite existing tracked state with empty or preview state' },
          { status: 409 }
        )
      }
    }
    
    const updateFields: { stateData: string; timezone?: string } = { stateData }
    if (timezone) {
      updateFields.timezone = timezone
    }

    // Upsert the user state
    await UserState.findOneAndUpdate(
      { userId: session.user.id },
      { $set: updateFields },
      { upsert: true, returnDocument: 'after' }
    )

    await syncCanonicalCollectionsFromState(incomingState as StateRecord, session.user.id)

    // Phase 1 (Strangler Fig migration): shadow dual-write into the
    // normalized HabitSchedule collection. Non-blocking to correctness —
    // wrapped internally so it can never fail this request or corrupt
    // the legacy stateData save above, which remains authoritative.
    await dualWriteHabitSchedules(
      session.user.id,
      stateData,
      updateFields.timezone || 'Asia/Kolkata'
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving user state:', error)
    return NextResponse.json({ error: 'Failed to save user state' }, { status: 500 })
  }
}
