import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as contentReviewService from '../services/contentReview.service';

export const reviewContentSchema = z.object({
  status: z.enum(['approved', 'rejected']).optional(),
  decision: z.enum(['approved', 'rejected']).optional(),
  reviewNotes: z.string().max(1000).optional(),
  reason: z.string().max(1000).optional(),
}).refine(data => data.status || data.decision, {
  message: 'Either status or decision is required',
});

export const contentReviewIdParamSchema = z.object({
  id: z.string().min(1),
});

export const contentReviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

export async function getPending(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const reviews = await contentReviewService.getPending(page, limit);
    res.status(200).json(reviews);
  } catch (err) {
    next(err);
  }
}

export async function reviewContent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Accept both {status, reviewNotes} and {decision, reason} from frontend
    const status = req.body.status || req.body.decision;
    const reviewNotes = req.body.reviewNotes || req.body.reason || '';
    const result = await contentReviewService.reviewContent(
      req.params.id,
      req.user!.userId,
      status,
      reviewNotes,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
