import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { RateLimitError } from '../utils/errors';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const windowMs = 60_000;
const ipLimits = new Map<string, RateLimitEntry>();
const accountLimits = new Map<string, RateLimitEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of ipLimits) {
    if (entry.resetAt <= now) ipLimits.delete(key);
  }
  for (const [key, entry] of accountLimits) {
    if (entry.resetAt <= now) accountLimits.delete(key);
  }
}, 30_000);

/**
 * Pre-auth IP-based rate limiter. Catches brute-force before authentication runs.
 */
export function rateLimiter(req: Request, _res: Response, next: NextFunction): void {
  const key = req.ip || 'unknown';
  const now = Date.now();
  let entry = ipLimits.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    ipLimits.set(key, entry);
  }

  entry.count++;

  if (entry.count > config.rateLimitPerMin) {
    return next(new RateLimitError('Rate limit exceeded. Maximum 60 requests per minute.'));
  }

  next();
}

/**
 * Post-auth per-account rate limiter. Must be mounted after authenticate middleware.
 */
export function accountRateLimiter(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.userId) return next();

  const key = req.user.userId;
  const now = Date.now();
  let entry = accountLimits.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    accountLimits.set(key, entry);
  }

  entry.count++;

  if (entry.count > config.rateLimitPerMin) {
    return next(new RateLimitError('Per-account rate limit exceeded.'));
  }

  next();
}
