import mongoose, { Schema, Document } from 'mongoose';
import { ContentReviewStatus } from '../types/enums';

export interface IPortfolioImage extends Document {
  portfolioId: mongoose.Types.ObjectId;
  originalPath: string;
  previewPath: string;
  watermarkEnabled: boolean;
  copyrightNotice: string;
  caption: string;
  sortOrder: number;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
  reviewStatus: ContentReviewStatus;
}

const PortfolioImageSchema = new Schema<IPortfolioImage>({
  portfolioId: { type: Schema.Types.ObjectId, ref: 'Portfolio', required: true },
  originalPath: { type: String, required: true },
  previewPath: { type: String, required: true },
  watermarkEnabled: { type: Boolean, default: true },
  copyrightNotice: { type: String, default: '' },
  caption: { type: String, default: '' },
  sortOrder: { type: Number, default: 0 },
  mimeType: { type: String, default: '' },
  sizeBytes: { type: Number, default: 0 },
  originalName: { type: String, default: '' },
  reviewStatus: { type: String, enum: Object.values(ContentReviewStatus), default: ContentReviewStatus.PENDING },
}, { timestamps: true });

PortfolioImageSchema.index({ portfolioId: 1, sortOrder: 1 });

export const PortfolioImage = mongoose.model<IPortfolioImage>('PortfolioImage', PortfolioImageSchema);
