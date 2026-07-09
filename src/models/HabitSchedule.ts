import mongoose, { Schema, Document } from 'mongoose'

// NOTE: deliberately NOT named "Habit" — src/models/Habit.ts already registers
// that model name against an unrelated, unused legacy schema. Do not merge
// these without first confirming src/models/Habit.ts and its call sites
// (src/actions/habit-actions.ts, entry-actions.ts, tracker.ts) are actually
// dead before deleting — see Phase 5 cleanup note.

export interface IHabitSchedule extends Document {
  userId: string
  habitId: string           // id from the legacy stateData.gridData blob entry
  name: string
  category: string
  time: string               // "HH:MM", local to user's timezone
  frequency: number[]        // days of week, 0-6
  timezone: string
  offsetMinutes: number       // pre-reminder offset (habit.notification)
  retryEnabled: boolean
  pushEnabled: boolean
  nextFireAt: Date | null     // UTC instant of next scheduled trigger; null if inactive
  lastFiredKind: 'initial' | 'retry1' | 'retry2' | 'exact' | null
  lastFiredAt: Date | null
  active: boolean             // false once removed from the legacy blob
  createdAt: Date
  updatedAt: Date
}

const HabitScheduleSchema: Schema = new Schema(
  {
    userId:         { type: String, required: true },
    habitId:        { type: String, required: true },
    name:           { type: String, required: true },
    category:       { type: String, required: true },
    time:           { type: String, required: true },
    frequency:      { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },
    timezone:       { type: String, required: true },
    offsetMinutes:  { type: Number, default: 0 },
    retryEnabled:   { type: Boolean, default: true },
    pushEnabled:    { type: Boolean, default: true },
    nextFireAt:     { type: Date, default: null },
    lastFiredKind:  { type: String, enum: ['initial', 'retry1', 'retry2', 'exact', null], default: null },
    lastFiredAt:    { type: Date, default: null },
    active:         { type: Boolean, default: true },
  },
  { timestamps: true }
)

// One doc per (user, habit) — dual-write upserts against this.
HabitScheduleSchema.index({ userId: 1, habitId: 1 }, { unique: true })

// The query the Phase-2 scheduler will run. Index must exist from day one
// so it's warm before anything reads it under load.
HabitScheduleSchema.index({ nextFireAt: 1, active: 1 })

export default mongoose.models.HabitSchedule ||
  mongoose.model<IHabitSchedule>('HabitSchedule', HabitScheduleSchema)