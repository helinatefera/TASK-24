import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as reportService from '../services/report.service';

export const createReportSchema = z.object({
  targetType: z.enum(['user', 'portfolio', 'portfolio_image', 'job', 'message']).optional(),
  targetId: z.string().min(1).optional(),
  targetUserId: z.string().min(1).optional(),
  targetContentId: z.string().min(1).optional(),
  category: z.enum([
    'inappropriate_content',
    'harassment',
    'fraud',
    'copyright_violation',
    'spam',
    'other',
  ]),
  description: z.string().min(1).max(2000),
}).refine(data => data.targetId || data.targetUserId || data.targetContentId, {
  message: 'At least one target identifier is required',
});

export const reviewReportSchema = z.object({
  status: z.enum([
    'under_review',
    'needs_more_info',
    'action_taken',
    'rejected',
    'closed',
  ]),
  adminNotes: z.string().max(2000).optional(),
});

export const reportIdParamSchema = z.object({
  id: z.string().min(1),
});

export const adminReportsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum([
    'submitted',
    'under_review',
    'needs_more_info',
    'action_taken',
    'rejected',
    'closed',
  ]).optional(),
  category: z.enum([
    'inappropriate_content',
    'harassment',
    'fraud',
    'copyright_violation',
    'spam',
    'other',
  ]).optional(),
});

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Resolve target: accept targetType+targetId or targetUserId/targetContentId
    const targetType = req.body.targetType || (req.body.targetUserId ? 'user' : 'message');
    const targetId = req.body.targetId || req.body.targetUserId || req.body.targetContentId;

    // Require at least one evidence attachment — reports without evidence
    // cannot be acted on by moderators and enable abuse of the flag system.
    const uploadedFiles = req.files as Express.Multer.File[] | undefined;
    if (!uploadedFiles || uploadedFiles.length === 0) {
      res.status(400).json({ code: 400, msg: 'At least one evidence file is required to submit a report' });
      return;
    }

    // Validate file type/format/size then store as FileAttachment records
    const evidenceAttachmentIds: string[] = [];
    const { validateAndStore } = await import('../services/file.service');
    for (const file of uploadedFiles) {
      const attachment = await validateAndStore({
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        parentType: 'report',
        parentId: req.user!.userId,
        uploadedBy: req.user!.userId,
      });
      evidenceAttachmentIds.push(attachment._id!.toString());
    }

    const report = await reportService.createReport(req.user!.userId, {
      targetType,
      targetId,
      category: req.body.category,
      description: req.body.description,
      evidenceAttachmentIds,
    });
    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
}

export async function getMyReports(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const reports = await reportService.getMyReports(req.user!.userId);
    res.status(200).json(reports);
  } catch (err) {
    next(err);
  }
}

export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const reports = await reportService.getAllReports(page, limit);
    res.status(200).json(reports);
  } catch (err) {
    next(err);
  }
}

export async function review(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const report = await reportService.reviewReport(
      req.params.id,
      req.user!.userId,
      req.body.status,
      req.body.adminNotes,
      req.body.resolution,
    );
    res.status(200).json(report);
  } catch (err) {
    next(err);
  }
}
