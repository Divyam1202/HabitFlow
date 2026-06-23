import mongoose, { Schema, Document } from 'mongoose'

export type NotificationLogStatus =
  | 'scheduled'
  | 'evaluated'
  | 'triggered'
  | 'sent'
  | 'failed'
  | 'delivered'
  | 'opened'
  | 'completed'
  | 'skipped'
  | 'snoozed'

export interface INotificationLog extends Document {
  userId: string
  habitId: string
  habitName: string
  notificationId?: string
  scheduledTime: string
  triggerTime: string
  timezone: string
  status: NotificationLogStatus
  errorMessage?: string
  createdAt: Date
}

const NotificationLogSchema: Schema = new Schema(
  {
    userId:         { type: String, required: true, index: true },
    habitId:        { type: String, required: true, index: true },
    habitName:      { type: String, required: true },
    notificationId: { type: String },
    scheduledTime:  { type: String, required: true },
    triggerTime:    { type: String, required: true },
    timezone:       { type: String, required: true },
    status:         {
      type: String,
      required: true,
      enum: [
        'scheduled',
        'evaluated',
        'triggered',
        'sent',
        'failed',
        'delivered',
        'opened',
        'completed',
        'skipped',
        'snoozed'
      ],
      index: true
    },
    errorMessage:   { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

// Index for query efficiency
NotificationLogSchema.index({ createdAt: -1 })
NotificationLogSchema.index({ status: 1, createdAt: -1 })

export default mongoose.models.NotificationLog ||
  mongoose.model<INotificationLog>('NotificationLog', NotificationLogSchema)
