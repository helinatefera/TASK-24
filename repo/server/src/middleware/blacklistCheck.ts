import { Request, Response, NextFunction } from 'express';
import { Blacklist } from '../models/Blacklist';
import { DeviceFingerprint, hashFingerprint } from '../models/DeviceFingerprint';
import { ForbiddenError } from '../utils/errors';
import { BlacklistTargetType, AccountStatus } from '../types/enums';

export async function blacklistCheck(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.user) return next();

  try {
    // ANY blacklist hit (account OR device) → deny access
    if (req.user.accountStatus === AccountStatus.BANNED || req.user.accountStatus === AccountStatus.SUSPENDED) {
      return next(new ForbiddenError('Account is banned or suspended'));
    }

    const accountBlacklisted = await Blacklist.findOne({
      targetType: BlacklistTargetType.ACCOUNT,
      targetId: req.user.userId,
    });
    if (accountBlacklisted) {
      return next(new ForbiddenError('Account is blacklisted'));
    }

    const rawFp = req.headers['x-device-fingerprint'] as string;
    if (rawFp) {
      // Hash the fingerprint for lookup (stored hashed)
      const hashedFp = hashFingerprint(rawFp);

      const deviceBlacklisted = await Blacklist.findOne({
        targetType: BlacklistTargetType.DEVICE,
        targetId: hashedFp,
      });
      if (deviceBlacklisted) {
        return next(new ForbiddenError('Device is blacklisted'));
      }

      const deviceRecord = await DeviceFingerprint.findOne({ fingerprintHash: hashedFp });
      if (deviceRecord?.isBlacklisted) {
        return next(new ForbiddenError('Device is blacklisted'));
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}
