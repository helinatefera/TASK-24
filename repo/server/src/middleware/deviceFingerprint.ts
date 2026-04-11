import { Request, Response, NextFunction } from 'express';
import { DeviceFingerprint, hashFingerprint } from '../models/DeviceFingerprint';
import { DataCategoryConsent } from '../models/DataCategoryConsent';

export async function deviceFingerprintMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.user) return next();

  const rawFp = req.headers['x-device-fingerprint'] as string;
  if (!rawFp) return next();

  try {
    const consent = await DataCategoryConsent.findOne({
      userId: req.user.userId,
      dataCategory: 'device_fingerprint',
      revokedAt: { $exists: false },
    });

    // MUST NOT generate or store fingerprint before consent
    if (!consent) return next();

    // Always hash the fingerprint before storing or comparing
    const hashedFp = hashFingerprint(rawFp);

    const existing = await DeviceFingerprint.findOne({
      userId: req.user.userId,
      fingerprintHash: hashedFp,
    });

    if (existing) {
      existing.lastSeenAt = new Date();
      await existing.save();
    } else {
      await DeviceFingerprint.create({
        userId: req.user.userId,
        fingerprintHash: hashedFp,
        consentGiven: true,
        userAgent: req.headers['user-agent'],
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      });
    }

    req.deviceFingerprint = hashedFp;
    next();
  } catch (err) {
    next(err);
  }
}
