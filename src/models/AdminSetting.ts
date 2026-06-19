import mongoose, { Schema, Document } from 'mongoose'

export interface IAdminSetting extends Document {
  siteName: string;
  supportEmail: string;
  version: string;
  allowRegistration: boolean;
  maintenanceMode: boolean;
  privacyPolicyUrl: string;
  termsUrl: string;
  updatedAt: Date;
}

const AdminSettingSchema: Schema = new Schema(
  {
    siteName: { type: String, default: 'HabytFlow', required: true },
    supportEmail: { type: String, default: 'habytflow+support@gmail.com', required: true },
    version: { type: String, default: '1.0.0', required: true },
    allowRegistration: { type: Boolean, default: true, required: true },
    maintenanceMode: { type: Boolean, default: false, required: true },
    privacyPolicyUrl: { type: String, default: '/about/privacy', required: true },
    termsUrl: { type: String, default: '/about/terms', required: true }
  },
  { timestamps: true }
)

export default mongoose.models.AdminSetting || mongoose.model<IAdminSetting>('AdminSetting', AdminSettingSchema)
