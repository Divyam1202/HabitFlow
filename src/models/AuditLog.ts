import mongoose, { Schema, Document } from 'mongoose'

export interface IAuditLog extends Document {
  adminId: string;
  adminEmail: string;
  action: 'ADMIN_LOGIN' | 'USER_SUSPENDED' | 'USER_UNSUSPENDED' | 'USER_DELETED' | 'ANNOUNCEMENT_PUBLISHED' | 'SETTINGS_CHANGED';
  details: string;
  createdAt: Date;
}

const AuditLogSchema: Schema = new Schema(
  {
    adminId: { type: String, required: true },
    adminEmail: { type: String, required: true },
    action: {
      type: String,
      enum: ['ADMIN_LOGIN', 'USER_SUSPENDED', 'USER_UNSUSPENDED', 'USER_DELETED', 'ANNOUNCEMENT_PUBLISHED', 'SETTINGS_CHANGED'],
      required: true
    },
    details: { type: String, required: true }
  },
  { timestamps: true }
)

export default mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema)
