import { Request, Response, NextFunction } from 'express';
import { SensitiveWord } from '../models/SensitiveWord';

let wordSet: Set<string> = new Set();
let loaded = false;

export async function loadSensitiveWords(): Promise<void> {
  const words = await SensitiveWord.find({ isActive: true });
  wordSet = new Set(words.map(w => w.word.toLowerCase()));
  loaded = true;
}

export function scanText(text: string): { isClean: boolean; matchedWords: string[] } {
  if (!text || wordSet.size === 0) return { isClean: true, matchedWords: [] };
  const lower = text.toLowerCase();
  const matched: string[] = [];
  for (const word of wordSet) {
    if (lower.includes(word)) {
      matched.push(word);
    }
  }
  return { isClean: matched.length === 0, matchedWords: matched };
}

export function contentFilterMiddleware(textFields: string[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!loaded) {
      try { await loadSensitiveWords(); } catch { /* proceed without filter */ }
    }

    const flaggedWords: string[] = [];
    for (const field of textFields) {
      const value = req.body?.[field];
      if (typeof value === 'string') {
        const result = scanText(value);
        flaggedWords.push(...result.matchedWords);
      }
    }

    if (flaggedWords.length > 0) {
      (req as any).flaggedWords = [...new Set(flaggedWords)];
      (req as any).contentFlagged = true;
    }

    next();
  };
}
