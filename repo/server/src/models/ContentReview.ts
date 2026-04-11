import mongoose, { Schema, Document } from 'mongoose';
import { ContentReviewStatus, ReviewableContentType } from '../types/enums';

export interface IContentReview extends Document {
  contentType: ReviewableContentType;
  contentId: mongoose.Types.ObjectId;
  submittedBy: mongoose.Types.ObjectId;
  status: ContentReviewStatus;
  flaggedWords: string[];
  reviewedBy?: mongoose.Types.ObjectId;
  reviewNotes?: string;
  reviewedAt?: Date;
}

const ContentReviewSchema = new Schema<IContentReview>({
  contentType: { type: String, enum: Object.values(ReviewableContentType), required: true },
  contentId: { type: Schema.Types.ObjectId, required: true },
  submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: Object.values(ContentReviewStatus), default: ContentReviewStatus.PENDING },
  flaggedWords: [String],
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewNotes: String,
  reviewedAt: Date,
}, { timestamps: true });

ContentReviewSchema.index({ status: 1 });
ContentReviewSchema.index({ contentType: 1, contentId: 1 });

export const ContentReview = mongoose.model<IContentReview>('ContentReview', ContentReviewSchema);
