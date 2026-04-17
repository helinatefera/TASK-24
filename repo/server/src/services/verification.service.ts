import { Verification, User } from '../models';
import { VerificationStatus, Role } from '../types/enums';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { encrypt, decrypt } from './encryption.service';
import { maskIdentifier } from '../utils/masking';
import { logEvent } from './audit.service';
import { AUDIT_EVENTS } from '../utils/constants';
import { beforeVerificationApprove } from '../hooks/complianceHooks';

export interface SubmitVerificationInput {
  photographerId: string;
  realName: string;
  qualificationType: string;
  issuingAuthority?: string;
  idDocumentPath: string;
  qualificationDocPaths: string[];
  taxFormPath?: string;
  fileChecksums: string[];
}

export async function submitVerification(input: SubmitVerificationInput) {
  // Enforce first-use consent for government_id and qualification_documents
  const { checkConsent } = await import('./dataCategoryConsent.service');
  const { hasConsent: hasGovIdConsent } = await checkConsent(input.photographerId, 'government_id');
  if (!hasGovIdConsent) {
    throw new ForbiddenError('Consent for government_id data category is required before submitting verification');
  }
  const { hasConsent: hasQualConsent } = await checkConsent(input.photographerId, 'qualification_documents');
  if (!hasQualConsent) {
    throw new ForbiddenError('Consent for qualification_documents data category is required before submitting verification');
  }

  // If tax form is provided, enforce tax_forms consent
  if (input.taxFormPath) {
    const { hasConsent: hasTaxConsent } = await checkConsent(input.photographerId, 'tax_forms');
    if (!hasTaxConsent) {
      throw new ForbiddenError('Consent for tax_forms data category is required before submitting tax documents');
    }
  }

  // Encrypt sensitive fields with category-specific derived keys
  const encryptedRealName = encrypt(input.realName, 'government_id');
  const encryptedIdDocPath = encrypt(input.idDocumentPath, 'government_id');
  const encryptedQualDocPaths = input.qualificationDocPaths.map(
    p => encrypt(p, 'qualification_documents')
  );
  const encryptedTaxFormPath = input.taxFormPath
    ? encrypt(input.taxFormPath, 'tax_forms')
    : undefined;

  const verification = await Verification.create({
    photographerId: input.photographerId,
    realName: encryptedRealName,
    qualificationType: input.qualificationType,
    issuingAuthority: input.issuingAuthority,
    idDocumentPath: encryptedIdDocPath,
    qualificationDocPaths: encryptedQualDocPaths,
    taxFormPath: encryptedTaxFormPath,
    status: VerificationStatus.SUBMITTED,
    submittedAt: new Date(),
    fileChecksums: input.fileChecksums,
  });

  await logEvent({
    actorId: input.photographerId,
    action: AUDIT_EVENTS.KYC_SUBMIT,
    resource: 'verification',
    resourceId: verification._id.toString(),
    outcome: 'success',
  });

  return verification;
}

export interface AdminReviewInput {
  verificationId: string;
  reviewerId: string;
  decision: VerificationStatus.VERIFIED | VerificationStatus.REJECTED | VerificationStatus.NEEDS_CHANGES;
  reason: string;
}

export async function adminReview(input: AdminReviewInput) {
  if (!input.reason || input.reason.trim().length === 0) {
    throw new ValidationError('A review reason is mandatory');
  }

  const verification = await Verification.findById(input.verificationId);
  if (!verification) {
    throw new NotFoundError('Verification not found');
  }

  if (
    verification.status !== VerificationStatus.SUBMITTED &&
    verification.status !== VerificationStatus.NEEDS_CHANGES
  ) {
    throw new ValidationError(
      `Cannot review a verification with status: ${verification.status}`
    );
  }

  // Run compliance hook before approving
  if (input.decision === VerificationStatus.VERIFIED) {
    const complianceResult = await beforeVerificationApprove(verification.toObject());
    if (!complianceResult.allow) {
      throw new ForbiddenError(
        complianceResult.reason || 'Compliance check failed for verification approval'
      );
    }
  }

  verification.status = input.decision;
  verification.reviewReason = input.reason;
  verification.reviewedBy = input.reviewerId as any;
  verification.reviewedAt = new Date();
  await verification.save();

  const auditAction =
    input.decision === VerificationStatus.VERIFIED
      ? AUDIT_EVENTS.KYC_APPROVE
      : input.decision === VerificationStatus.REJECTED
        ? AUDIT_EVENTS.KYC_REJECT
        : AUDIT_EVENTS.KYC_REVIEW;

  await logEvent({
    actorId: input.reviewerId,
    action: auditAction,
    resource: 'verification',
    resourceId: verification._id.toString(),
    details: { decision: input.decision, reason: input.reason },
    outcome: 'success',
  });

  return verification;
}

export async function getVerificationByPhotographer(photographerId: string) {
  const verification = await Verification.findOne({ photographerId }).sort({ submittedAt: -1 });
  if (!verification) {
    throw new NotFoundError('Verification not found');
  }
  return verification;
}

export async function listPendingVerifications() {
  return Verification.find({
    status: { $in: [VerificationStatus.SUBMITTED, VerificationStatus.NEEDS_CHANGES] },
  }).sort({ submittedAt: 1 }).lean();
}

/**
 * Get verification record. Non-admin viewers get masked identifiers.
 */
export async function getVerification(
  verificationId: string,
  viewerRole: Role
) {
  const verification = await Verification.findById(verificationId);
  if (!verification) {
    throw new NotFoundError('Verification not found');
  }

  const obj = verification.toObject() as any;

  if (viewerRole === Role.ADMIN) {
    // Decrypt for admin
    try {
      obj.realName = decrypt(obj.realName, 'government_id');
      obj.idDocumentPath = decrypt(obj.idDocumentPath, 'government_id');
      obj.qualificationDocPaths = obj.qualificationDocPaths.map(
        (p: string) => decrypt(p, 'qualification_documents')
      );
      if (obj.taxFormPath) {
        obj.taxFormPath = decrypt(obj.taxFormPath, 'tax_forms');
      }
    } catch {
      // If decryption fails, return as-is
    }
  } else {
    // Mask identifiers for non-admin
    try {
      const decryptedName = decrypt(obj.realName, 'government_id');
      obj.realName = maskIdentifier(decryptedName);
    } catch {
      obj.realName = '***';
    }
    obj.idDocumentPath = '[REDACTED]';
    obj.qualificationDocPaths = obj.qualificationDocPaths.map(() => '[REDACTED]');
    if (obj.taxFormPath) obj.taxFormPath = '[REDACTED]';
  }

  return obj;
}
