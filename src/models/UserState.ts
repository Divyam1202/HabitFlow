import mongoose, { Schema, Document } from 'mongoose'

export interface IUserState extends Document {
  userId: string;
  stateData: string; // JSON string containing the full habit state
  fcmToken?: string;
  timezone: string;
  notificationStatus?: string;
  lastNotificationFailure?: Date;
  lastNotificationFailureReason?: string;
  lastTokenRefreshAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserStateSchema: Schema = new Schema(
  {
    userId: { type: String, required: true, index: true, unique: true },
    stateData: { type: String, required: true },
    fcmToken: { type: String },
    timezone: { type: String, default: "UTC" },
    notificationStatus: { type: String, default: "active" },
    lastNotificationFailure: { type: Date },
    lastNotificationFailureReason: { type: String },
    lastTokenRefreshAt: { type: Date }
  },
  { timestamps: true }
)

export default mongoose.models.UserState || mongoose.model<IUserState>('UserState', UserStateSchema)
