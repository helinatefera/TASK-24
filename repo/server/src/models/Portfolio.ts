import mongoose, { Schema, Document } from 'mongoose';
import { ContentReviewStatus } from '../types/enums';

export interface IPortfolio extends Document {
  photographerId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  specialties: string[];
  reviewStatus: ContentReviewStatus;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  reviewNotes?: string;
}

const PortfolioSchema = new Schema<IPortfolio>({
  photographerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  specialties: [String],
  reviewStatus: { type: String, enum: Object.values(ContentReviewStatus), default: ContentReviewStatus.PENDING },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  reviewNotes: String,
}, { timestamps: true });

PortfolioSchema.index({ photographerId: 1 });
PortfolioSchema.index({ reviewStatus: 1 });

export const Portfolio = mongoose.model<IPortfolio>('Portfolio', PortfolioSchema);
