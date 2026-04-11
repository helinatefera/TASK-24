import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as portfolioService from '../services/portfolio.service';
import * as fileService from '../services/file.service';

export const createPortfolioSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
  visibility: z.enum(['public', 'alumni_only', 'private']).optional(),
});

export const updatePortfolioSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
  visibility: z.enum(['public', 'alumni_only', 'private']).optional(),
});

export const portfolioIdParamSchema = z.object({
  id: z.string().min(1),
});

export const removeImageParamSchema = z.object({
  id: z.string().min(1),
  imageId: z.string().min(1),
});

export const portfolioQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  userId: z.string().optional(),
});

export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await portfolioService.listPortfolios({
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

function normalizeImage(img: any) {
  return {
    id: img._id,
    url: img.originalPath,
    previewUrl: img.previewPath || img.originalPath,
    caption: img.caption || '',
    copyrightNotice: img.copyrightNotice || '',
    watermarkEnabled: img.watermarkEnabled ?? true,
    mimeType: img.mimeType,
    reviewStatus: img.reviewStatus,
    createdAt: img.createdAt,
  };
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { PortfolioImage } = await import('../models');
    const portfolio = await portfolioService.getPortfolioById(req.params.id);
    const rawImages = await PortfolioImage.find({ portfolioId: req.params.id }).sort({ sortOrder: 1 }).lean();
    const portfolioObj = portfolio.toObject ? portfolio.toObject() : portfolio;
    res.status(200).json({ ...portfolioObj, images: rawImages.map(normalizeImage) });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const portfolio = await portfolioService.createPortfolio({
      photographerId: req.user!.userId,
      title: req.body.title,
      description: req.body.description,
      specialties: req.body.tags,
    });
    res.status(201).json(portfolio);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const portfolio = await portfolioService.updatePortfolio(
      req.params.id,
      req.user!.userId,
      req.user!.role,
      req.body,
    );
    res.status(200).json(portfolio);
  } catch (err) {
    next(err);
  }
}

export async function addImage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ code: 400, msg: 'No file uploaded' });
      return;
    }
    const attachment = await fileService.validateAndStore({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      parentType: 'portfolio',
      parentId: req.params.id,
      uploadedBy: req.user!.userId,
    });
    const result = await portfolioService.addImage(
      req.params.id,
      req.user!.userId,
      attachment.storagePath,
      req.file.originalname,
      req.file.mimetype,
      attachment.sizeBytes,
      {
        copyrightNotice: req.body.copyrightNotice || '',
        caption: req.body.caption || '',
        watermarkEnabled: req.body.watermarkEnabled !== 'false',
      },
    );
    res.status(201).json(normalizeImage(result.toObject ? result.toObject() : result));
  } catch (err) {
    next(err);
  }
}

export async function getImages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { PortfolioImage } = await import('../models');
    const images = await PortfolioImage.find({ portfolioId: req.params.id }).sort({ sortOrder: 1 }).lean();
    res.status(200).json({ images: images.map(normalizeImage) });
  } catch (err) {
    next(err);
  }
}

export async function removeImage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await portfolioService.removeImage(req.params.id, req.params.imageId, req.user!.userId);
    res.status(200).json({ msg: 'Image removed' });
  } catch (err) {
    next(err);
  }
}
