import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { connectToDatabase } from '@/lib/db'
import UserState from '@/models/UserState'
import { auth } from '@/lib/auth'
import { dualWriteHabitSchedules } from '@/lib/dual-write-schedule'

const DEFAULT_PREVIEW_HABIT_NAMES = ['Gym', 'Reading', 'Touch Grass', 'Skincare', 'Digital Detox']

type StateRecord = Record<string, unknown>

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

export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers })
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectToDatabase()
    
    const userState = await UserState.findOne({ userId: session.user.id })
    
    if (!userState) {
      return NextResponse.json({ stateData: null, timezone: null })
    }
    
    let parsedState = null
    try {
      parsedState = JSON.parse(userState.stateData)
    } catch {
      return NextResponse.json({ error: 'Stored user state is invalid JSON' }, { status: 500 })
    }

    return NextResponse.json({
      stateData: userState.stateData,
      parsedState,
      timezone: userState.timezone || 'Asia/Kolkata'
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
