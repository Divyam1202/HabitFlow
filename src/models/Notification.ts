import mongoose, { Schema, Document } from 'mongoose'

export type NotificationStatus =
  | 'pending'
  | 'delivered'
  | 'opened'
  | 'completed'
  | 'skipped'
  | 'snoozed'
  | 'expired'

export interface INotification extends Document {
  userId: string
  habitId: string
  habitName: string
  category: string
  title: string
  body: string
  scheduledFor: Date
  localDateKey: string
  status: NotificationStatus
  retryCount: number // 0 = original, 1 = +15m, 2 = +45m
  snoozedUntil?: Date
  deliveredAt?: Date
  openedAt?: Date
  completedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const NotificationSchema: Schema = new Schema(
  {
    userId:      { type: String, required: true, index: true },
    habitId:     { type: String, required: true },
    habitName:   { type: String, required: true },
    category:    { type: String, required: true },
    title:       { type: String, required: true },
    body:        { type: String, required: true },
    scheduledFor:{ type: Date,   required: true },
    localDateKey:{ type: String, required: true },
    status:      {
      type: String,
      enum: ['pending','delivered','opened','completed','skipped','snoozed','expired'],
      default: 'delivered',
    },
    retryCount:  { type: Number, default: 0 },
    snoozedUntil:{ type: Date },
    deliveredAt: { type: Date },
    openedAt:    { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
)

// Compound indexes for fast queries
NotificationSchema.index({ userId: 1, scheduledFor: -1 })
NotificationSchema.index({ userId: 1, status: 1 })
NotificationSchema.index({ userId: 1, createdAt: -1 })
NotificationSchema.index(
  { userId: 1, habitId: 1, retryCount: 1, localDateKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      localDateKey: { $type: 'string' },
    },
  }
)

export default mongoose.models.Notification ||
  mongoose.model<INotification>('Notification', NotificationSchema)
