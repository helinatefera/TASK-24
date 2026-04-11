import { Consent, PrivacyPolicy } from '../models';
import { NotFoundError, ValidationError } from '../utils/errors';
import { CONSENT_RECHECK_DAYS } from '../utils/constants';
import { logEvent } from './audit.service';
import { AUDIT_EVENTS } from '../utils/constants';

export interface RecordConsentInput {
  userId: string;
  policyVersion: string;
  purposes: { purpose: string; consented: boolean }[];
}

export async function recordConsent(input: RecordConsentInput) {
  const policy = await PrivacyPolicy.findOne({ version: input.policyVersion });
  if (!policy) {
    throw new NotFoundError(`Privacy policy version ${input.policyVersion} not found`);
  }

  // Deactivate any previous active consent for this user
  await Consent.updateMany(
    { userId: input.userId, isActive: true },
    { $set: { isActive: false } }
  );

  const now = new Date();
  const reconsentDeadline = new Date(now.getTime() + CONSENT_RECHECK_DAYS * 24 * 60 * 60 * 1000);

  const consent = await Consent.create({
    userId: input.userId,
    policyVersion: input.policyVersion,
    purposes: input.purposes.map(p => ({
      purpose: p.purpose,
      consented: p.consented,
      consentedAt: now,
    })),
    consentedAt: now,
    reconsentDeadline,
    isActive: true,
  });

  await logEvent({
    actorId: input.userId,
    action: AUDIT_EVENTS.CONSENT_GRANTED,
    resource: 'consent',
    resourceId: consent._id.toString(),
    details: { policyVersion: input.policyVersion, purposes: input.purposes },
    outcome: 'success',
  });

  return consent;
}

export async function checkConsentCurrent(userId: string): Promise<{
  isCurrent: boolean;
  consent: any | null;
  needsReconsent: boolean;
}> {
  const activeConsent = await Consent.findOne({ userId, isActive: true });

  if (!activeConsent) {
    return { isCurrent: false, consent: null, needsReconsent: true };
  }

  const latestPolicy = await PrivacyPolicy.findOne().sort({ effectiveDate: -1 });

  if (!latestPolicy) {
    return { isCurrent: true, consent: activeConsent, needsReconsent: false };
  }

  // Consent is stale if policy version doesn't match the latest
  if (activeConsent.policyVersion !== latestPolicy.version) {
    return { isCurrent: false, consent: activeConsent, needsReconsent: true };
  }

  // Check reconsent deadline
  const now = new Date();
  if (activeConsent.reconsentDeadline && now > activeConsent.reconsentDeadline) {
    return { isCurrent: false, consent: activeConsent, needsReconsent: true };
  }

  return { isCurrent: true, consent: activeConsent, needsReconsent: false };
}

export async function getPolicyHistory() {
  return PrivacyPolicy.find().sort({ effectiveDate: -1 }).lean();
}

export async function getConsentHistory(userId: string) {
  const history = await Consent.find({ userId })
    .sort({ consentedAt: -1 })
    .lean();
  return history;
}
