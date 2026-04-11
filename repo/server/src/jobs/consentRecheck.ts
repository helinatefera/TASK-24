import { PrivacyPolicy } from '../models/PrivacyPolicy';
import { Consent } from '../models/Consent';
import { logger } from '../utils/logger';

export async function recheckConsents(): Promise<void> {
  const latestPolicy = await PrivacyPolicy.findOne().sort({ effectiveDate: -1 });
  if (!latestPolicy || latestPolicy.newPurposesIntroduced.length === 0) return;

  const consentsNeedingUpdate = await Consent.find({
    policyVersion: { $ne: latestPolicy.version },
    isActive: true,
  });

  let count = 0;
  for (const consent of consentsNeedingUpdate) {
    consent.isActive = false;
    await consent.save();
    count++;
  }

  if (count > 0) {
    logger.info(`Flagged ${count} consents for re-consent due to new policy purposes`);
  }
}
