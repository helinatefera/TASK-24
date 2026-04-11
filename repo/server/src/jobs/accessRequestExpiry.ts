import { AccessRequest } from '../models/AccessRequest';
import { AuditLog } from '../models/AuditLog';
import { AccessRequestStatus } from '../types/enums';
import { AUDIT_EVENTS } from '../utils/constants';
import { logger } from '../utils/logger';

export async function expireAccessRequests(): Promise<void> {
  const now = new Date();
  const expired = await AccessRequest.find({
    status: AccessRequestStatus.PENDING,
    expiresAt: { $lte: now },
  });

  for (const req of expired) {
    req.status = AccessRequestStatus.EXPIRED;
    await req.save();

    await AuditLog.create({
      timestamp: now,
      action: AUDIT_EVENTS.ACCESS_REQUEST_EXPIRED,
      resource: 'access_request',
      resourceId: req._id!.toString(),
      details: { targetUserId: req.targetUserId, requesterId: req.requesterId },
      outcome: 'success',
    });
  }

  if (expired.length > 0) {
    logger.info(`Expired ${expired.length} access requests`);
  }
}
