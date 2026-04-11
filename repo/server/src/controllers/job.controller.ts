import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as jobService from '../services/job.service';

export const createJobSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  jobType: z.enum(['event', 'portrait']),
  rateType: z.enum(['hourly', 'piece_rate']),
  rate: z.number().positive().optional(),
  agreedRateCents: z.number().positive().optional(),
  estimatedTotalCents: z.number().nonnegative().optional(),
  location: z.string().max(500).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  requirements: z.array(z.string()).optional(),
});

export const updateJobSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  jobType: z.enum(['event', 'portrait']).optional(),
  rateType: z.enum(['hourly', 'piece_rate']).optional(),
  rate: z.number().positive().optional(),
  location: z.string().max(500).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  requirements: z.array(z.string()).optional(),
  status: z.enum(['draft', 'posted', 'cancelled']).optional(),
});

export const assignJobSchema = z.object({
  photographerId: z.string().min(1),
});

export const jobIdParamSchema = z.object({
  id: z.string().min(1),
});

export const jobQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['draft', 'posted', 'assigned', 'in_progress', 'review', 'completed', 'cancelled', 'disputed']).optional(),
  jobType: z.enum(['event', 'portrait']).optional(),
  search: z.string().optional(),
});

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await jobService.createJob({
      title: req.body.title,
      description: req.body.description,
      clientId: req.user!.userId,
      communityId: req.user!.communityId,
      jobType: req.body.jobType,
      rateType: req.body.rateType,
      agreedRateCents: req.body.agreedRateCents || req.body.rate,
      estimatedTotalCents: req.body.estimatedTotalCents,
    });
    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
}

export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Scope job list to user's community (admins see all)
    const filters: any = {
      status: req.query.status as any,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };
    if (req.user!.role !== 'admin') {
      filters.communityId = req.user!.communityId;
    }
    const result = await jobService.listJobs(filters);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await jobService.getJobById(req.params.id, req.user!.userId);
    res.status(200).json(job);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await jobService.updateJob(req.params.id, req.user!.userId, req.body);
    res.status(200).json(job);
  } catch (err) {
    next(err);
  }
}

export async function assign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await jobService.assignPhotographer(
      req.params.id,
      req.body.photographerId,
      req.user!.userId,
      req.user!.role,
    );
    res.status(200).json(job);
  } catch (err) {
    next(err);
  }
}

export async function confirmAgreement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { password } = req.body;
    if (!password) {
      res.status(400).json({ code: 400, msg: 'Password is required to confirm agreement' });
      return;
    }
    const result = await jobService.confirmAgreement(
      req.params.id,
      req.user!.userId,
      password,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
