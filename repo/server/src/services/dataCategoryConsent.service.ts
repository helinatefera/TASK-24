import { DataCategoryConsent } from '../models';
import { NotFoundError, ValidationError } from '../utils/errors';
import { DATA_CATEGORIES, AUDIT_EVENTS } from '../utils/constants';
import { logEvent } from './audit.service';

export async function checkConsent(
  userId: string,
  dataCategory: string
): Promise<{ hasConsent: boolean; consent: any | null }> {
  const consent = await DataCategoryConsent.findOne({
    userId,
    dataCategory,
    revokedAt: { $exists: false },
  });

  return {
    hasConsent: !!consent,
    consent: consent ? consent.toObject() : null,
  };
}

export interface RecordDataCategoryConsentInput {
  userId: string;
  dataCategory: string;
  disclosureText: string;
  purposeDescription: string;
}

export async function recordConsent(input: RecordDataCategoryConsentInput) {
  if (!DATA_CATEGORIES.includes(input.dataCategory as any)) {
    throw new ValidationError(
      `Invalid data category: ${input.dataCategory}. Must be one of: ${DATA_CATEGORIES.join(', ')}`
    );
  }

  // Revoke any existing active consent for this category before recording new one
  await DataCategoryConsent.updateMany(
    { userId: input.userId, dataCategory: input.dataCategory, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );

  const consent = await DataCategoryConsent.create({
    userId: input.userId,
    dataCategory: input.dataCategory,
    disclosureText: input.disclosureText || `Consent granted for ${input.dataCategory} data processing`,
    purposeDescription: input.purposeDescription || `Processing of ${input.dataCategory} data as described in the privacy policy`,
    consentedAt: new Date(),
  });

  await logEvent({
    actorId: input.userId,
    action: AUDIT_EVENTS.CONSENT_GRANTED,
    resource: 'data_category_consent',
    resourceId: consent._id.toString(),
    details: { dataCategory: input.dataCategory },
    outcome: 'success',
  });

  return consent;
}

export async function getActiveConsents(userId: string) {
  const consents = await DataCategoryConsent.find({
    userId,
    revokedAt: { $exists: false },
  }).sort({ consentedAt: -1 });
  return consents;
}

export async function revokeConsent(userId: string, dataCategory: string) {
  const consent = await DataCategoryConsent.findOneAndUpdate(
    { userId, dataCategory, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
    { new: true }
  );

  if (!consent) {
    throw new NotFoundError(`No active consent found for category: ${dataCategory}`);
  }

  await logEvent({
    actorId: userId,
    action: AUDIT_EVENTS.CONSENT_REVOKED,
    resource: 'data_category_consent',
    resourceId: consent._id.toString(),
    details: { dataCategory },
    outcome: 'success',
  });

  return consent;
}
