import { Job, FileAttachment, Settlement, Report, Verification, Portfolio } from '../models';
import { Role } from '../types/enums';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { logEvent } from './audit.service';
import { AUDIT_EVENTS } from '../utils/constants';

/**
 * Authorization matrix for document access — resolved per-parent:
 *   settlement  → settlement client or photographer, or admin
 *   deliverable → job client or photographer, or admin
 *   verification → the photographer who owns the verification, or admin
 *   report      → the reporter who filed it, or admin
 *   portfolio   → the photographer who owns the portfolio, or admin
 *
 * Uploader match alone is NOT sufficient when the parent carries its own access policy.
 */
export async function checkDocumentAccess(
  fileId: string,
  userId: string,
  userRole: Role,
  ipAddress?: string
): Promise<{ allowed: boolean; file: any }> {
  const file = await FileAttachment.findById(fileId);
  if (!file) {
    throw new NotFoundError('Document not found');
  }

  // Admins always have access
  if (userRole === Role.ADMIN) {
    return { allowed: true, file: file.toObject() };
  }

  let allowed = false;

  switch (file.parentType) {
    case 'settlement': {
      const settlement = await Settlement.findById(file.parentId);
      if (settlement) {
        allowed =
          settlement.clientId.toString() === userId ||
          settlement.photographerId.toString() === userId;
      }
      break;
    }
    case 'deliverable': {
      // parentId is the jobId for deliverables
      const job = await Job.findById(file.parentId);
      if (job) {
        allowed =
          job.clientId.toString() === userId ||
          (job.photographerId && job.photographerId.toString() === userId);
      }
      break;
    }
    case 'verification': {
      // parentId is the photographer's userId for verification docs
      allowed = file.parentId.toString() === userId;
      if (!allowed) {
        const verification = await Verification.findOne({ photographerId: file.parentId });
        if (verification) {
          allowed = verification.photographerId.toString() === userId;
        }
      }
      break;
    }
    case 'report': {
      const report = await Report.findById(file.parentId).catch(() => null);
      if (report) {
        allowed = report.reporterId.toString() === userId;
      } else {
        // parentId may be the reporter's userId (from report create flow)
        allowed = file.parentId.toString() === userId;
      }
      break;
    }
    case 'portfolio': {
      const portfolio = await Portfolio.findById(file.parentId);
      if (portfolio) {
        allowed = portfolio.photographerId.toString() === userId;
      }
      break;
    }
    default:
      // Unknown parent type — deny
      allowed = false;
  }

  if (allowed) {
    return { allowed: true, file: file.toObject() };
  }

  // Access denied — audit-log the denial
  await logEvent({
    actorId: userId,
    action: AUDIT_EVENTS.ACCESS_DENIED,
    resource: 'file_attachment',
    resourceId: fileId,
    details: {
      parentType: file.parentType,
      parentId: file.parentId.toString(),
      reason: 'not_authorized_for_parent_resource',
    },
    ipAddress,
    outcome: 'failure',
  });

  throw new ForbiddenError('You do not have access to this document');
}

export async function getAccessibleDocuments(
  parentType: string,
  parentId: string,
  userId: string,
  userRole: Role
) {
  if (userRole === Role.ADMIN) {
    return FileAttachment.find({ parentType, parentId }).lean();
  }

  // Verify user has access to the specific parent
  let allowed = false;
  if (parentType === 'settlement') {
    const settlement = await Settlement.findById(parentId);
    if (settlement) {
      allowed =
        settlement.clientId.toString() === userId ||
        settlement.photographerId.toString() === userId;
    }
  } else if (parentType === 'deliverable') {
    const job = await Job.findById(parentId);
    if (job) {
      allowed =
        job.clientId.toString() === userId ||
        (job.photographerId && job.photographerId.toString() === userId);
    }
  } else if (parentType === 'verification') {
    allowed = parentId === userId;
  } else if (parentType === 'report') {
    const report = await Report.findById(parentId).catch(() => null);
    allowed = report ? report.reporterId.toString() === userId : parentId === userId;
  } else if (parentType === 'portfolio') {
    const portfolio = await Portfolio.findById(parentId);
    allowed = portfolio ? portfolio.photographerId.toString() === userId : false;
  }

  if (!allowed) {
    throw new ForbiddenError('You do not have access to these documents');
  }

  return FileAttachment.find({ parentType, parentId }).lean();
}
