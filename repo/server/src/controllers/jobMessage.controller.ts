import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as jobMessageService from '../services/jobMessage.service';

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  messageText: z.string().min(1).max(5000).optional(),
}).refine(data => data.content || data.messageText, {
  message: 'Either content or messageText is required',
});

export const jobIdParamSchema = z.object({
  jobId: z.string().min(1),
});

export const listMessagesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function send(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const message = await jobMessageService.sendMessage({
      jobId: req.params.jobId,
      senderId: req.user!.userId,
      messageText: req.body.messageText || req.body.content,
    });
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const messages = await jobMessageService.listMessages(
      req.params.jobId,
      req.user!.userId,
      page,
      limit,
    );
    res.status(200).json(messages);
  } catch (err) {
    next(err);
  }
}
