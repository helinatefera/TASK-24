import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as fileService from '../services/file.service';

export const fileIdParamSchema = z.object({
  id: z.string().min(1),
});

export async function getFile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = await fileService.getFile(req.params.id, req.user!.userId);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    res.status(200).send(file.buffer);
  } catch (err) {
    next(err);
  }
}
