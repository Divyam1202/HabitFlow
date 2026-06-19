import mongoose, { Schema, Document } from 'mongoose'

export interface IFeedback extends Document {
  email: string;
  type: 'BUG_REPORT' | 'FEATURE_REQUEST' | 'GENERAL_FEEDBACK';
  message: string;
  status: 'OPEN' | 'IN_REVIEW' | 'PLANNED' | 'RESOLVED' | 'CLOSED';
  createdAt: Date;
  updatedAt: Date;
}

const FeedbackSchema: Schema = new Schema(
  {
    email: { type: String, required: true },
    type: {
      type: String,
      enum: ['BUG_REPORT', 'FEATURE_REQUEST', 'GENERAL_FEEDBACK'],
      default: 'GENERAL_FEEDBACK',
      required: true
    },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ['OPEN', 'IN_REVIEW', 'PLANNED', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
      required: true
    }
  },
  { timestamps: true }
)

export default mongoose.models.Feedback || mongoose.model<IFeedback>('Feedback', FeedbackSchema)
