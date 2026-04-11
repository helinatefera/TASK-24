import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as workEntryService from '../services/workEntry.service';

export const createWorkEntrySchema = z.object({
  entryType: z.enum(['time', 'piece_rate']),
  description: z.string().max(1000).optional(),
  date: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  quantity: z.number().int().positive().optional(),
  itemDescription: z.string().max(1000).optional(),
  unitRateCents: z.number().int().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
});

export const updateWorkEntrySchema = z.object({
  description: z.string().max(1000).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  quantity: z.number().int().positive().optional(),
  itemDescription: z.string().max(1000).optional(),
  notes: z.string().max(1000).optional(),
});

export const jobIdParamSchema = z.object({
  jobId: z.string().min(1),
});

export const workEntryIdParamSchema = z.object({
  id: z.string().min(1),
});

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const entry = await workEntryService.createWorkEntry({
      jobId: req.params.jobId,
      photographerId: req.user!.userId,
      entryType: req.body.entryType,
      date: req.body.date ? new Date(req.body.date) : undefined,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      durationMinutes: req.body.durationMinutes,
      itemDescription: req.body.description || req.body.itemDescription,
      quantity: req.body.quantity,
      unitRateCents: req.body.unitRateCents,
      notes: req.body.notes,
    });
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
}

export async function getByJob(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const entries = await workEntryService.getWorkEntriesByJob(req.params.jobId, req.user!.userId);
    res.status(200).json(entries);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const entry = await workEntryService.editWorkEntry(req.params.id, req.user!.userId, req.body);
    res.status(200).json(entry);
  } catch (err) {
    next(err);
  }
}

export async function confirm(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const entry = await workEntryService.confirmWorkEntry(req.params.id, req.user!.userId);
    res.status(200).json(entry);
  } catch (err) {
    next(err);
  }
}
