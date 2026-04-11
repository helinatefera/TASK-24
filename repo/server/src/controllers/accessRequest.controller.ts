import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as accessRequestService from '../services/accessRequest.service';

export const createRequestSchema = z.object({
  targetUserId: z.string().min(1),
  reason: z.string().min(1).max(500),
  requestedFields: z.array(z.string()).min(1).optional(),
  fields: z.array(z.string()).min(1).optional(),
}).refine(data => data.requestedFields || data.fields, {
  message: 'Either requestedFields or fields is required',
});

export const respondToRequestSchema = z.object({
  status: z.enum(['approved', 'denied']),
  responseMessage: z.string().max(500).optional(),
});

export const requestIdParamSchema = z.object({
  id: z.string().min(1),
});

export async function createRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const request = await accessRequestService.createAccessRequest({
      requesterId: req.user!.userId,
      targetUserId: req.body.targetUserId,
      fields: req.body.requestedFields || req.body.fields,
      reason: req.body.reason,
      ipAddress: req.ip,
    });
    res.status(201).json(request);
  } catch (err) {
    next(err);
  }
}

export async function getIncoming(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const requests = await accessRequestService.getIncoming(req.user!.userId);
    res.status(200).json(requests);
  } catch (err) {
    next(err);
  }
}

export async function getOutgoing(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const requests = await accessRequestService.getOutgoing(req.user!.userId);
    res.status(200).json(requests);
  } catch (err) {
    next(err);
  }
}

export async function respondToRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await accessRequestService.respondToAccessRequest({
      requestId: req.params.id,
      responderId: req.user!.userId,
      decision: req.body.status,
      ipAddress: req.ip,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
