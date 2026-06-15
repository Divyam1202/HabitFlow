import mongoose, { Schema, Document } from 'mongoose'

export interface IPushSubscription extends Document {
  userId: string;
  subscription: any;
  createdAt: Date;
  updatedAt: Date;
}

const PushSubscriptionSchema: Schema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    subscription: { type: Schema.Types.Mixed, required: true },
    timezone: { type: String, default: 'UTC' }
  },
  { timestamps: true }
)

export default mongoose.models.PushSubscription || mongoose.model<IPushSubscription>('PushSubscription', PushSubscriptionSchema)
