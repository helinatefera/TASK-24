import { Profile, User, IProfile } from '../models';
import { NotFoundError, ForbiddenError } from '../utils/errors';
import { PrivacyLevel, Role } from '../types/enums';
import { applyFieldPrivacy } from './privacy.service';

export async function createProfile(userId: string, data: Partial<IProfile>) {
  const profile = await Profile.create({
    userId,
    ...data,
  });
  return profile;
}

export async function getProfileById(profileId: string) {
  const profile = await Profile.findById(profileId);
  if (!profile) {
    throw new NotFoundError('Profile not found');
  }
  return profile;
}

export async function getProfileByUserId(userId: string) {
  const profile = await Profile.findOne({ userId });
  if (!profile) {
    throw new NotFoundError('Profile not found');
  }
  return profile;
}

export async function updateProfile(userId: string, data: Partial<IProfile>) {
  // Enforce first-use consent for contact/employer data before storing
  const { checkConsent } = await import('./dataCategoryConsent.service');
  if (data.phone || (data as any).contactInfo) {
    const { hasConsent } = await checkConsent(userId, 'contact_information');
    if (!hasConsent) {
      throw new ForbiddenError('Consent for contact_information is required before saving contact data');
    }
  }
  if ((data as any).employer) {
    const { hasConsent } = await checkConsent(userId, 'employer_information');
    if (!hasConsent) {
      throw new ForbiddenError('Consent for employer_information is required before saving employer data');
    }
  }

  const profile = await Profile.findOneAndUpdate(
    { userId },
    { $set: data },
    { new: true, runValidators: true }
  );
  if (!profile) {
    throw new NotFoundError('Profile not found');
  }
  return profile;
}

export async function deleteProfile(userId: string) {
  const result = await Profile.findOneAndDelete({ userId });
  if (!result) {
    throw new NotFoundError('Profile not found');
  }
  return result;
}

export async function getAllProfiles(filters: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  communityId?: string;
}) {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const query: any = {};
  if (filters.search) {
    query.$or = [
      { firstName: { $regex: filters.search, $options: 'i' } },
      { lastName: { $regex: filters.search, $options: 'i' } },
    ];
  }

  // Community isolation: if communityId is provided, only return users from that community
  let userFilter: any = {};
  if (filters.communityId) {
    const communityUsers = await User.find({ communityId: filters.communityId }).select('_id').lean();
    const userIds = communityUsers.map(u => u._id);
    query.userId = { $in: userIds };
  }

  const [profiles, total] = await Promise.all([
    Profile.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Profile.countDocuments(query),
  ]);

  // Minimize public fields — strip private data from list results
  const minimized = profiles.map(p => ({
    _id: p._id,
    userId: p.userId,
    firstName: p.firstName,
    lastName: p.lastName,
    displayName: (p as any).displayName,
    createdAt: (p as any).createdAt,
  }));

  return { profiles: minimized, total, page, limit };
}

export interface ProfileViewer {
  userId: string;
  role: Role;
  isAlumni: boolean;
  communityId: string;
}

/**
 * Get a profile with privacy rules applied based on the viewer's identity.
 */
export async function getProfileWithPrivacy(
  targetUserId: string,
  viewer: ProfileViewer
) {
  const profile = await Profile.findOne({ userId: targetUserId });
  if (!profile) {
    throw new NotFoundError('Profile not found');
  }

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    throw new NotFoundError('User not found');
  }

  // Owner or admin sees everything
  if (viewer.userId === targetUserId || viewer.role === Role.ADMIN) {
    return profile.toObject();
  }

  const profileObj = profile.toObject() as any;
  const privacySettings = profileObj.privacySettings || {};

  const privacyFields: string[] = [
    'firstName', 'lastName', 'phone', 'email', 'bio',
    'location', 'employer', 'graduationYear',
  ];

  for (const field of privacyFields) {
    const level = (privacySettings as any)[field] as PrivacyLevel;
    const rawValue = (profileObj as any)[field];

    if (rawValue === undefined || rawValue === null || rawValue === '') {
      continue;
    }

    (profileObj as any)[field] = applyFieldPrivacy(
      field,
      String(rawValue),
      level,
      viewer.isAlumni,
      viewer.communityId,
      targetUser.communityId
    );
  }

  return profileObj;
}
