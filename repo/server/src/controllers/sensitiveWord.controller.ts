import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { SensitiveWord } from '../models/SensitiveWord';
import { loadSensitiveWords } from '../middleware/contentFilter';

export const createSensitiveWordSchema = z.object({
  word: z.string().min(1).max(100).trim().toLowerCase(),
  severity: z.enum(['low', 'medium', 'high']).default('medium'),
});

export const sensitiveWordIdParamSchema = z.object({
  id: z.string().min(1),
});

export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const words = await SensitiveWord.find().sort({ word: 1 });
    res.status(200).json(words);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const word = await SensitiveWord.create({
      word: req.body.word,
      severity: req.body.severity,
      addedBy: req.user!.userId,
    });
    await loadSensitiveWords();
    res.status(201).json(word);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const word = await SensitiveWord.findByIdAndDelete(req.params.id);
    if (!word) {
      res.status(404).json({ code: 404, msg: 'Sensitive word not found' });
      return;
    }
    await loadSensitiveWords();
    res.status(200).json({ msg: 'Sensitive word removed' });
  } catch (err) {
    next(err);
  }
}
