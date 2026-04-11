import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as deliverableService from '../services/deliverable.service';
import * as fileService from '../services/file.service';

export const jobIdParamSchema = z.object({
  jobId: z.string().min(1),
});

export const uploadBodySchema = z.object({
  copyrightNotice: z.string().min(1, 'Copyright notice is required').max(1000),
});

export async function upload(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ code: 400, msg: 'No file uploaded' });
      return;
    }
    // Validate file type/format/size then store
    const attachment = await fileService.validateAndStore({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      parentType: 'deliverable',
      parentId: req.params.jobId,
      uploadedBy: req.user!.userId,
    });
    const deliverable = await deliverableService.upload(
      req.params.jobId,
      req.user!.userId,
      attachment.storagePath,
      req.body.copyrightNotice,
      req.user!.userId,
    );
    res.status(201).json(deliverable);
  } catch (err) {
    next(err);
  }
}

export async function getByJob(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const deliverables = await deliverableService.getByJob(req.params.jobId, req.user!.userId);
    res.status(200).json(deliverables);
  } catch (err) {
    next(err);
  }
}
