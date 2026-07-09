import mongoose, { Schema, Document } from 'mongoose'

export interface IShadowSendLog extends Document {
  userId: string
  habitId: string
  habitName: string
  scheduledFor: Date     // the nextFireAt value that triggered this
  evaluatedAt: Date       // when the shadow scheduler actually ran
  mode: 'shadow' | 'canary_live'   // canary_live = Phase 3, real FCM was sent
  outcome: 'would_send' | 'sent' | 'skipped_completed' | 'skipped_pref' | 'error'
  errorMessage?: string
  createdAt: Date
}

const ShadowSendLogSchema: Schema = new Schema(
  {
    userId:        { type: String, required: true },
    habitId:       { type: String, required: true },
    habitName:     { type: String, required: true },
    scheduledFor:  { type: Date, required: true },
    evaluatedAt:   { type: Date, required: true },
    mode:          { type: String, enum: ['shadow', 'canary_live'], required: true },
    outcome:       { type: String, enum: ['would_send', 'sent', 'skipped_completed', 'skipped_pref', 'error'], required: true },
    errorMessage:  { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

ShadowSendLogSchema.index({ userId: 1, habitId: 1, createdAt: -1 })
ShadowSendLogSchema.index({ mode: 1, createdAt: -1 })

export default mongoose.models.ShadowSendLog ||
  mongoose.model<IShadowSendLog>('ShadowSendLog', ShadowSendLogSchema)