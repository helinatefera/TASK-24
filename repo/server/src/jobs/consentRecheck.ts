import { PrivacyPolicy } from '../models/PrivacyPolicy';
import { Consent } from '../models/Consent';
import { CONSENT_RECHECK_DAYS } from '../utils/constants';
import { logger } from '../utils/logger';

/**
 * Re-consent semantics with 30-day grace window:
 *
 * When a new privacy policy introduces new purposes, existing consents on older
 * versions get flagged (`needsReconsent = true`) and a `reconsentDeadline` is
 * set to `policyChangeDetectedAt + CONSENT_RECHECK_DAYS` (30 days).
 *
 * During the grace window, `isActive` stays true and the user can still act —
 * the UI is expected to surface the reconsent banner. After the deadline
 * passes, consent is deactivated on the next cron run.
 */
export async function recheckConsents(): Promise<void> {
  const latestPolicy = await PrivacyPolicy.findOne().sort({ effectiveDate: -1 });
  if (!latestPolicy || latestPolicy.newPurposesIntroduced.length === 0) return;

  const now = new Date();
  const graceMs = CONSENT_RECHECK_DAYS * 24 * 60 * 60 * 1000;

  // Step 1: Flag any consents that are on an older policy version but not yet flagged.
  const toFlag = await Consent.find({
    policyVersion: { $ne: latestPolicy.version },
    isActive: true,
    $or: [{ needsReconsent: false }, { needsReconsent: { $exists: false } }],
  });

  let flagged = 0;
  for (const consent of toFlag) {
    consent.needsReconsent = true;
    consent.policyChangeDetectedAt = now;
    consent.reconsentDeadline = new Date(now.getTime() + graceMs);
    await consent.save();
    flagged++;
  }

  // Step 2: Deactivate consents whose grace window has elapsed.
  const expired = await Consent.find({
    isActive: true,
    needsReconsent: true,
    reconsentDeadline: { $lte: now },
  });

  let deactivated = 0;
  for (const consent of expired) {
    consent.isActive = false;
    await consent.save();
    deactivated++;
  }

  if (flagged > 0) {
    logger.info(`Flagged ${flagged} consents for re-consent (30-day grace window started)`);
  }
  if (deactivated > 0) {
    logger.info(`Deactivated ${deactivated} consents whose 30-day grace window expired`);
  }
}
