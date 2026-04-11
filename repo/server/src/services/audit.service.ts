import { AuditLog } from '../models';

export interface AuditLogInput {
  actorId?: string;
  actorRole?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  deviceFingerprint?: string;
  outcome: 'success' | 'failure';
  requestId?: string;
}

/**
 * Insert-only audit log. Never update or delete audit entries.
 */
export async function logEvent(input: AuditLogInput): Promise<void> {
  await AuditLog.create({
    timestamp: new Date(),
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: input.action,
    resource: input.resource,
    resourceId: input.resourceId,
    details: input.details,
    ipAddress: input.ipAddress,
    deviceFingerprint: input.deviceFingerprint,
    outcome: input.outcome,
    requestId: input.requestId,
  });
}
