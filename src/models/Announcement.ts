import mongoose, { Schema, Document } from 'mongoose'

export interface IAnnouncement extends Document {
  title: string;
  message: string;
  type: 'NEW_FEATURE' | 'MAINTENANCE' | 'BUG_FIXES' | 'UPDATE_NOTES';
  audience: 'ALL_USERS' | 'PREMIUM_USERS' | 'INACTIVE_USERS';
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['NEW_FEATURE', 'MAINTENANCE', 'BUG_FIXES', 'UPDATE_NOTES'],
      required: true
    },
    audience: {
      type: String,
      enum: ['ALL_USERS', 'PREMIUM_USERS', 'INACTIVE_USERS'],
      default: 'ALL_USERS',
      required: true
    },
    createdById: { type: String, required: true }
  },
  { timestamps: true }
)

export default mongoose.models.Announcement || mongoose.model<IAnnouncement>('Announcement', AnnouncementSchema)
