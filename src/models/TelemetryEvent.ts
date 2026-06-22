import mongoose, { Schema, Document } from 'mongoose'

export interface ITelemetryEvent extends Document {
  eventType: 'habit_created' | 'habit_completed' | 'journey_started' | 'notification_delivered' | 'notification_opened' | 'notification_completed' | 'notification_skipped' | 'notification_snoozed'
  metadata: {
    habitName?: string
    category?: string
  }
  createdAt: Date
}

const TelemetryEventSchema: Schema = new Schema({
  eventType: { 
    type: String, 
    enum: [
      'habit_created', 
      'habit_completed', 
      'journey_started',
      'notification_delivered',
      'notification_opened',
      'notification_completed',
      'notification_skipped',
      'notification_snoozed'
    ], 
    required: true 
  },
  metadata: {
    habitName: { type: String },
    category: { type: String }
  },
  createdAt: { type: Date, default: Date.now },
})

export default mongoose.models.TelemetryEvent || mongoose.model<ITelemetryEvent>('TelemetryEvent', TelemetryEventSchema)
