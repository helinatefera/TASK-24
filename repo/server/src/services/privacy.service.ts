import { PrivacyLevel } from '../types/enums';
import { maskField } from '../utils/masking';
import { Profile } from '../models';
import { NotFoundError } from '../utils/errors';

export async function getPrivacySettings(userId: string) {
  const profile = await Profile.findOne({ userId });
  if (!profile) {
    throw new NotFoundError('Profile not found');
  }
  return profile.privacySettings;
}

export async function updatePrivacySettings(userId: string, settings: Record<string, PrivacyLevel>) {
  const profile = await Profile.findOne({ userId });
  if (!profile) {
    throw new NotFoundError('Profile not found');
  }

  const updateFields: Record<string, any> = {};
  for (const [key, value] of Object.entries(settings)) {
    updateFields[`privacySettings.${key}`] = value;
  }

  const updated = await Profile.findOneAndUpdate(
    { userId },
    { $set: updateFields },
    { new: true, runValidators: true },
  );

  return updated!.privacySettings;
}

/**
 * Apply privacy rules to a single field value.
 *
 * Rules:
 *   public       -> always visible
 *   alumni_only  -> visible if viewer isAlumni AND in the same community; otherwise masked
 *   private      -> always masked (unless owner/admin — handled at caller level)
 */
export function applyFieldPrivacy(
  fieldName: string,
  value: string,
  level: PrivacyLevel,
  viewerIsAlumni: boolean,
  viewerCommunityId: string,
  ownerCommunityId: string
): string {
  if (level === PrivacyLevel.PUBLIC) {
    return value;
  }

  if (level === PrivacyLevel.ALUMNI_ONLY) {
    if (viewerIsAlumni && viewerCommunityId === ownerCommunityId) {
      return value;
    }
    return maskField(fieldName, value);
  }

  // PrivacyLevel.PRIVATE — always mask for non-owner/non-admin callers
  return maskField(fieldName, value);
}
