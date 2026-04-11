import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as escrowService from '../services/escrow.service';

export const addEscrowEntrySchema = z.object({
  entryType: z.enum(['deposit', 'release', 'refund', 'adjustment']).optional().default('deposit'),
  amountCents: z.number().int().nonnegative(),
  description: z.string().min(1).max(500),
});

export const jobIdParamSchema = z.object({
  jobId: z.string().min(1),
});

export async function addEntry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // req.body is already validated and defaults applied by Zod schema
    const entry = await escrowService.addEntry(
      req.params.jobId,
      req.body.entryType,
      req.body.amountCents,
      req.body.description,
      req.user!.userId,
    );
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
}

export async function getByJob(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const entries = await escrowService.getByJob(req.params.jobId, req.user!.userId);
    const balanceCents = entries.length > 0 ? entries[entries.length - 1].balanceCents : 0;
    res.status(200).json({ entries, balanceCents });
  } catch (err) {
    next(err);
  }
}
