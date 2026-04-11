import mongoose, { Schema, Document } from 'mongoose';
import { ContentReviewStatus } from '../types/enums';

export interface IJobMessage extends Document {
  jobId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  messageText: string;
  reviewStatus: ContentReviewStatus;
  flaggedWords: string[];
  createdAt: Date;
}

const JobMessageSchema = new Schema<IJobMessage>({
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  messageText: { type: String, required: true },
  reviewStatus: { type: String, enum: Object.values(ContentReviewStatus), default: ContentReviewStatus.APPROVED },
  flaggedWords: [String],
}, { timestamps: true });

JobMessageSchema.index({ jobId: 1, createdAt: 1 });

export const JobMessage = mongoose.model<IJobMessage>('JobMessage', JobMessageSchema);
