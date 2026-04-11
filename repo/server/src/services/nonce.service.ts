import { Nonce } from '../models';
import { config } from '../config';
import { ConflictError, ValidationError } from '../utils/errors';

export async function validateNonce(nonce: string, timestamp: Date): Promise<void> {
  const now = Date.now();
  const ts = timestamp.getTime();
  const windowMs = config.nonceWindowMs;
  const skewMs = config.clockSkewMs;

  if (Math.abs(now - ts) > windowMs + skewMs) {
    throw new ValidationError('Nonce timestamp is outside the acceptable window');
  }

  const existing = await Nonce.findOne({ nonce });
  if (existing) {
    throw new ConflictError('Duplicate nonce detected — possible replay attack');
  }
}

export async function recordNonce(nonce: string, timestamp: Date): Promise<void> {
  await Nonce.create({ nonce, timestamp });
}
