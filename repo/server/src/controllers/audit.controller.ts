import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuditLog } from '../models/AuditLog';

export const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  action: z.string().optional(),
  resource: z.string().optional(),
  actorId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export async function getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit, action, resource, actorId, from, to } = req.query as any;

    const filter: Record<string, any> = {};
    if (action) filter.action = action;
    if (resource) filter.resource = resource;
    if (actorId) filter.actorId = actorId;
    if (from || to) {
      filter.timestamp = {};
      if (from) filter.timestamp.$gte = new Date(from as string);
      if (to) filter.timestamp.$lte = new Date(to as string);
    }

    const skip = ((page as number) - 1) * (limit as number);
    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit as number),
      AuditLog.countDocuments(filter),
    ]);

    res.status(200).json({
      data: logs,
      pagination: {
        page: page as number,
        limit: limit as number,
        total,
        totalPages: Math.ceil(total / (limit as number)),
      },
    });
  } catch (err) {
    next(err);
  }
}
