import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as verificationService from '../services/verification.service';

export const adminReviewSchema = z.object({
  status: z.enum(['verified', 'needs_changes', 'rejected']).optional(),
  decision: z.enum(['approved', 'verified', 'needs_changes', 'rejected']).optional(),
  reviewNotes: z.string().max(1000).optional(),
  rejectionReason: z.string().max(1000).optional(),
}).refine(data => data.status || data.decision, {
  message: 'Either status or decision is required',
});

export const verificationSubmitSchema = z.object({
  realName: z.string().min(2, 'Real name is required (min 2 characters)').max(200),
  qualificationType: z.enum(
    ['general', 'photography', 'videography', 'event', 'portrait', 'commercial'],
    { errorMap: () => ({ message: 'qualificationType must be one of: general, photography, videography, event, portrait, commercial' }) },
  ),
  issuingAuthority: z.string().max(200).optional(),
});

export const verificationIdParamSchema = z.object({
  id: z.string().min(1),
});

export async function submit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
      res.status(400).json({ code: 400, msg: 'No documents uploaded' });
      return;
    }

    // Validate required identity fields — reject placeholder/missing values
    const bodyParse = verificationSubmitSchema.safeParse(req.body);
    if (!bodyParse.success) {
      res.status(400).json({ code: 400, msg: bodyParse.error.errors[0].message });
      return;
    }
    // Handle both multer.fields() and multer.array() upload patterns
    let allFiles: Express.Multer.File[] = [];
    if (Array.isArray(req.files)) {
      allFiles = req.files;
    } else if (req.files && typeof req.files === 'object') {
      const fileMap = req.files as { [fieldname: string]: Express.Multer.File[] };
      for (const field of Object.values(fileMap)) {
        allFiles.push(...field);
      }
    }
    // Validate file type/format/size then store.
    // Checksums are computed server-side (SHA-256) — not client-supplied.
    const { validateAndStore } = await import('../services/file.service');
    const storedPaths: string[] = [];
    const checksums: string[] = [];
    for (const file of allFiles) {
      const attachment = await validateAndStore({
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        parentType: 'verification',
        parentId: req.user!.userId,
        uploadedBy: req.user!.userId,
      });
      storedPaths.push(attachment.storagePath);
      checksums.push(attachment.checksum);
    }
    // Handle tax form upload separately — stored and encrypted under 'tax_forms' category
    let taxFormPath: string | undefined;
    if (req.files && !Array.isArray(req.files) && req.files['taxForm']?.length) {
      const taxFile = req.files['taxForm'][0];
      const taxAttachment = await validateAndStore({
        buffer: taxFile.buffer,
        originalName: taxFile.originalname,
        mimeType: taxFile.mimetype,
        parentType: 'verification',
        parentId: req.user!.userId,
        uploadedBy: req.user!.userId,
      });
      taxFormPath = taxAttachment.storagePath;
      checksums.push(taxAttachment.checksum);
    }

    const result = await verificationService.submitVerification({
      photographerId: req.user!.userId,
      realName: bodyParse.data.realName,
      qualificationType: bodyParse.data.qualificationType,
      issuingAuthority: bodyParse.data.issuingAuthority,
      idDocumentPath: storedPaths[0] || '',
      qualificationDocPaths: storedPaths.slice(1),
      taxFormPath,
      fileChecksums: checksums,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const raw = await verificationService.getVerificationByPhotographer(req.user!.userId);
    // Use masking-aware path: non-admin users get masked sensitive fields
    const masked = await verificationService.getVerification(raw._id.toString(), req.user!.role);
    res.status(200).json(masked);
  } catch (err) {
    next(err);
  }
}

export async function getRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const requests = await verificationService.listPendingVerifications();
    // Admin gets decrypted view via getVerification
    const detailed = await Promise.all(
      requests.map(r => verificationService.getVerification((r as any)._id.toString(), req.user!.role))
    );
    res.status(200).json(detailed);
  } catch (err) {
    next(err);
  }
}

export async function adminReview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Normalize frontend vocabulary: 'approved' → 'verified'
    let rawDecision = req.body.status || req.body.decision;
    if (rawDecision === 'approved') rawDecision = 'verified';
    const reason = req.body.reviewNotes || req.body.rejectionReason || '';

    const result = await verificationService.adminReview({
      verificationId: req.params.id,
      reviewerId: req.user!.userId,
      decision: rawDecision,
      reason,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
