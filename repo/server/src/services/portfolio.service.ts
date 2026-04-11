import { Portfolio, PortfolioImage, IPortfolio } from '../models';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { ContentReviewStatus, Role } from '../types/enums';
import { applyWatermark } from './watermark.service';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';

export interface CreatePortfolioInput {
  photographerId: string;
  title: string;
  description?: string;
  specialties?: string[];
}

export async function createPortfolio(input: CreatePortfolioInput) {
  const portfolio = await Portfolio.create({
    photographerId: input.photographerId,
    title: input.title,
    description: input.description || '',
    specialties: input.specialties || [],
    reviewStatus: ContentReviewStatus.PENDING,
  });

  // Submit for content review
  const { submitForReview } = await import('./contentReview.service');
  const { ReviewableContentType } = await import('../types/enums');
  await submitForReview(ReviewableContentType.PORTFOLIO, portfolio._id.toString(), input.photographerId, []);

  return portfolio;
}

export async function getPortfolioById(portfolioId: string) {
  const portfolio = await Portfolio.findById(portfolioId);
  if (!portfolio) {
    throw new NotFoundError('Portfolio not found');
  }
  return portfolio;
}

export async function getPortfolioByPhotographer(photographerId: string) {
  const portfolio = await Portfolio.findOne({ photographerId });
  if (!portfolio) {
    throw new NotFoundError('Portfolio not found');
  }
  return portfolio;
}

export async function updatePortfolio(
  portfolioId: string,
  userId: string,
  userRole: Role,
  data: Partial<IPortfolio>
) {
  const portfolio = await Portfolio.findById(portfolioId);
  if (!portfolio) {
    throw new NotFoundError('Portfolio not found');
  }

  if (portfolio.photographerId.toString() !== userId && userRole !== Role.ADMIN) {
    throw new ForbiddenError('You can only edit your own portfolio');
  }

  // If content is edited, reset review status
  if (data.title !== undefined || data.description !== undefined) {
    data.reviewStatus = ContentReviewStatus.PENDING;
  }

  Object.assign(portfolio, data);
  await portfolio.save();
  return portfolio;
}

export async function deletePortfolio(portfolioId: string, userId: string, userRole: Role) {
  const portfolio = await Portfolio.findById(portfolioId);
  if (!portfolio) {
    throw new NotFoundError('Portfolio not found');
  }

  if (portfolio.photographerId.toString() !== userId && userRole !== Role.ADMIN) {
    throw new ForbiddenError('You can only delete your own portfolio');
  }

  // Delete associated images
  await PortfolioImage.deleteMany({ portfolioId });
  await Portfolio.findByIdAndDelete(portfolioId);
  return portfolio;
}

export async function addImage(
  portfolioId: string,
  userId: string,
  storagePath: string,
  originalName: string,
  mimeType: string,
  sizeBytes: number,
  options?: { copyrightNotice?: string; caption?: string; watermarkEnabled?: boolean },
) {
  const portfolio = await Portfolio.findById(portfolioId);
  if (!portfolio) {
    throw new NotFoundError('Portfolio not found');
  }

  if (portfolio.photographerId.toString() !== userId) {
    throw new ForbiddenError('You can only add images to your own portfolio');
  }

  const watermarkEnabled = options?.watermarkEnabled !== false;
  const copyrightNotice = options?.copyrightNotice || '';
  const caption = options?.caption || '';

  // Generate watermarked preview if watermark is enabled and file is an image
  let previewPath = storagePath;
  if (watermarkEnabled && (mimeType === 'image/jpeg' || mimeType === 'image/png')) {
    try {
      const originalBuffer = fs.readFileSync(storagePath);
      const watermarkText = copyrightNotice || `\u00A9 ${userId}`;
      const watermarkedBuffer = await applyWatermark(originalBuffer, {
        text: watermarkText,
        opacity: 0.3,
        position: 'center',
      });

      const ext = path.extname(storagePath);
      const previewFilename = `${uuidv4()}_wm${ext}`;
      const uploadDir = path.resolve(config.uploadDir);
      previewPath = path.join(uploadDir, previewFilename);
      fs.writeFileSync(previewPath, watermarkedBuffer);
    } catch {
      // If watermarking fails, fall back to original as preview
      previewPath = storagePath;
    }
  }

  const image = await PortfolioImage.create({
    portfolioId,
    originalPath: storagePath,
    previewPath,
    watermarkEnabled,
    copyrightNotice,
    caption,
    originalName,
    mimeType,
    sizeBytes,
    reviewStatus: ContentReviewStatus.PENDING,
  });

  return image;
}

export async function removeImage(
  portfolioId: string,
  imageId: string,
  userId: string
) {
  const portfolio = await Portfolio.findById(portfolioId);
  if (!portfolio) {
    throw new NotFoundError('Portfolio not found');
  }

  if (portfolio.photographerId.toString() !== userId) {
    throw new ForbiddenError('You can only remove images from your own portfolio');
  }

  const image = await PortfolioImage.findOneAndDelete({
    _id: imageId,
    portfolioId,
  });

  if (!image) {
    throw new NotFoundError('Image not found in this portfolio');
  }

  return image;
}

export async function listPortfolios(filters: {
  reviewStatus?: ContentReviewStatus;
  page?: number;
  limit?: number;
}) {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const query: any = {};
  if (filters.reviewStatus) {
    query.reviewStatus = filters.reviewStatus;
  }

  const [portfolios, total] = await Promise.all([
    Portfolio.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Portfolio.countDocuments(query),
  ]);

  return { portfolios, total, page, limit };
}
