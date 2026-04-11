import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { Nonce } from '../models/Nonce';
import { config } from '../config';
import { ConflictError, ValidationError } from '../utils/errors';

const NONCE_EXEMPT_PATHS = [
  'GET:/api/health',
];

export async function nonceReplay(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const routeKey = `${req.method}:${req.path}`;
    if (NONCE_EXEMPT_PATHS.includes(routeKey)) {
      return next();
    }

    const nonce = req.headers['x-nonce'] as string;
    const timestamp = req.headers['x-timestamp'] as string;

    if (!nonce || !timestamp) {
      return next(new ValidationError('X-Nonce and X-Timestamp headers are required'));
    }

    const requestTime = parseInt(timestamp, 10);
    if (isNaN(requestTime)) {
      return next(new ValidationError('Invalid X-Timestamp header'));
    }

    const now = Date.now();
    const diff = Math.abs(now - requestTime);

    if (diff > config.nonceWindowMs + config.clockSkewMs) {
      return next(new ValidationError('Request timestamp outside acceptable window'));
    }

    // Bind the nonce to the request method and path so a captured nonce
    // cannot be replayed against a different endpoint.
    const boundNonce = crypto
      .createHash('sha256')
      .update(`${nonce}:${req.method}:${req.path}`)
      .digest('hex');

    const existing = await Nonce.findOne({ nonce: boundNonce });
    if (existing) {
      return next(new ConflictError('Duplicate nonce detected - possible replay attack'));
    }

    await Nonce.create({ nonce: boundNonce, timestamp: new Date(requestTime) });
    req.nonce = nonce;
    next();
  } catch (err) {
    next(err);
  }
}
