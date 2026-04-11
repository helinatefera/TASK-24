import { AccessRequest } from '../models';
import { AccessRequestStatus } from '../types/enums';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { ACCESS_REQUEST_EXPIRY_DAYS, AUDIT_EVENTS } from '../utils/constants';
import { logEvent } from './audit.service';

export interface CreateAccessRequestInput {
  requesterId: string;
  targetUserId: string;
  fields: string[];
  reason: string;
  ipAddress?: string;
}

export async function createAccessRequest(input: CreateAccessRequestInput) {
  if (!input.fields || input.fields.length === 0) {
    throw new ValidationError('At least one field must be specified');
  }

  if (!input.reason || input.reason.trim().length === 0) {
    throw new ValidationError('A reason is required for access requests');
  }

  if (input.requesterId === input.targetUserId) {
    throw new ValidationError('You cannot request access to your own data');
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + ACCESS_REQUEST_EXPIRY_DAYS);

  const accessRequest = await AccessRequest.create({
    requesterId: input.requesterId,
    targetUserId: input.targetUserId,
    fields: input.fields,
    reason: input.reason,
    status: AccessRequestStatus.PENDING,
    expiresAt,
  });

  await logEvent({
    actorId: input.requesterId,
    action: AUDIT_EVENTS.ACCESS_REQUEST_CREATED,
    resource: 'access_request',
    resourceId: accessRequest._id.toString(),
    details: {
      targetUserId: input.targetUserId,
      fields: input.fields,
    },
    ipAddress: input.ipAddress,
    outcome: 'success',
  });

  return accessRequest;
}

export async function getIncoming(userId: string) {
  return AccessRequest.find({ targetUserId: userId }).sort({ createdAt: -1 }).lean();
}

export async function getOutgoing(userId: string) {
  return AccessRequest.find({ requesterId: userId }).sort({ createdAt: -1 }).lean();
}

export interface RespondAccessRequestInput {
  requestId: string;
  responderId: string;
  decision: AccessRequestStatus.APPROVED | AccessRequestStatus.DENIED;
  ipAddress?: string;
}

export async function respondToAccessRequest(input: RespondAccessRequestInput) {
  const request = await AccessRequest.findById(input.requestId);
  if (!request) {
    throw new NotFoundError('Access request not found');
  }

  if (request.status !== AccessRequestStatus.PENDING) {
    throw new ValidationError(`Cannot respond to a request with status: ${request.status}`);
  }

  // Only the target user can respond
  if (request.targetUserId.toString() !== input.responderId) {
    throw new ForbiddenError('Only the target user can respond to this access request');
  }

  // Check expiry
  if (new Date() > request.expiresAt) {
    request.status = AccessRequestStatus.EXPIRED;
    await request.save();

    await logEvent({
      actorId: input.responderId,
      action: AUDIT_EVENTS.ACCESS_REQUEST_EXPIRED,
      resource: 'access_request',
      resourceId: request._id.toString(),
      outcome: 'failure',
    });

    throw new ValidationError('This access request has expired');
  }

  request.status = input.decision;
  request.respondedAt = new Date();
  await request.save();

  const auditAction =
    input.decision === AccessRequestStatus.APPROVED
      ? AUDIT_EVENTS.ACCESS_REQUEST_APPROVED
      : AUDIT_EVENTS.ACCESS_REQUEST_DENIED;

  await logEvent({
    actorId: input.responderId,
    action: auditAction,
    resource: 'access_request',
    resourceId: request._id.toString(),
    details: {
      requesterId: request.requesterId.toString(),
      decision: input.decision,
      fields: request.fields,
    },
    ipAddress: input.ipAddress,
    outcome: 'success',
  });

  return request;
}
