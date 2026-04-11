import { User, Profile, Session } from '../models';
import { Role, AccountStatus } from '../types/enums';
import { AuthError, ValidationError, ForbiddenError, ConflictError } from '../utils/errors';
import { issueToken } from './token.service';
import { logEvent } from './audit.service';
import { AUDIT_EVENTS } from '../utils/constants';

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  role?: Role;
  isAlumni?: boolean;
  communityId?: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  ipAddress?: string;
  deviceFingerprint?: string;
}

export async function register(input: RegisterInput) {
  // Validate password strength
  if (!input.password || input.password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(input.password)) {
    throw new ValidationError('Password must contain an uppercase letter');
  }
  if (!/[a-z]/.test(input.password)) {
    throw new ValidationError('Password must contain a lowercase letter');
  }
  if (!/[0-9]/.test(input.password)) {
    throw new ValidationError('Password must contain a number');
  }

  const existingUser = await User.findOne({
    $or: [{ email: input.email.toLowerCase() }, { username: input.username }],
  });

  if (existingUser) {
    throw new ConflictError('A user with that email or username already exists');
  }

  // Defence-in-depth: never allow self-registration as admin
  if (input.role === Role.ADMIN) {
    throw new ValidationError('Cannot self-assign admin role');
  }

  const user = await User.create({
    username: input.username,
    email: input.email.toLowerCase(),
    passwordHash: input.password,
    role: input.role || Role.ALUMNI,
    isAlumni: input.isAlumni !== undefined ? input.isAlumni : true,
    communityId: input.communityId || 'default',
  });

  const profile = await Profile.create({
    userId: user._id,
    firstName: input.firstName || '',
    lastName: input.lastName || '',
    email: input.email.toLowerCase(),
  });

  const { token, jti, expiresAt } = issueToken(user._id!.toString(), user.role);
  await Session.create({
    userId: user._id,
    jti,
    issuedAt: new Date(),
    lastActivityAt: new Date(),
    absoluteExpiry: expiresAt,
  });

  return { user, profile, token };
}

export async function login(input: any) {
  const query = input.username
    ? { username: input.username }
    : { email: (input.email || '').toLowerCase() };
  const user = await User.findOne(query);

  if (!user) {
    await logEvent({
      action: AUDIT_EVENTS.LOGIN_FAILURE,
      resource: 'auth',
      details: { email: input.email, reason: 'user_not_found' },
      ipAddress: input.ipAddress,
      outcome: 'failure',
    });
    throw new AuthError('Invalid email or password');
  }

  if (user.accountStatus === AccountStatus.BANNED) {
    await logEvent({
      actorId: user._id.toString(),
      actorRole: user.role,
      action: AUDIT_EVENTS.LOGIN_FAILURE,
      resource: 'auth',
      resourceId: user._id.toString(),
      details: { reason: 'account_banned' },
      ipAddress: input.ipAddress,
      outcome: 'failure',
    });
    throw new ForbiddenError('This account has been banned');
  }

  if (user.accountStatus === AccountStatus.SUSPENDED) {
    await logEvent({
      actorId: user._id.toString(),
      actorRole: user.role,
      action: AUDIT_EVENTS.LOGIN_FAILURE,
      resource: 'auth',
      resourceId: user._id.toString(),
      details: { reason: 'account_suspended' },
      ipAddress: input.ipAddress,
      outcome: 'failure',
    });
    throw new ForbiddenError('This account is currently suspended');
  }

  const isMatch = await user.comparePassword(input.password);
  if (!isMatch) {
    user.failedLoginAttempts += 1;
    await user.save();

    await logEvent({
      actorId: user._id.toString(),
      actorRole: user.role,
      action: AUDIT_EVENTS.LOGIN_FAILURE,
      resource: 'auth',
      resourceId: user._id.toString(),
      details: { reason: 'invalid_password', attempts: user.failedLoginAttempts },
      ipAddress: input.ipAddress,
      outcome: 'failure',
    });
    throw new AuthError('Invalid email or password');
  }

  // Successful login — reset failed attempts
  user.failedLoginAttempts = 0;
  user.lastLoginAt = new Date();
  user.lastActivityAt = new Date();
  await user.save();

  const { token, jti, expiresAt } = issueToken(user._id.toString(), user.role);

  const session = await Session.create({
    userId: user._id,
    jti,
    deviceFingerprint: input.deviceFingerprint,
    issuedAt: new Date(),
    lastActivityAt: new Date(),
    absoluteExpiry: expiresAt,
  });

  await logEvent({
    actorId: user._id.toString(),
    actorRole: user.role,
    action: AUDIT_EVENTS.LOGIN_SUCCESS,
    resource: 'auth',
    resourceId: user._id.toString(),
    ipAddress: input.ipAddress,
    deviceFingerprint: input.deviceFingerprint,
    outcome: 'success',
  });

  return { user, token, session };
}

export async function logout(jti: string, userId: string): Promise<void> {
  const session = await Session.findOne({ jti, isRevoked: false });
  if (!session) {
    return; // Already revoked or doesn't exist — idempotent
  }

  // Verify the session belongs to the requesting user
  if (session.userId.toString() !== userId) {
    throw new ForbiddenError('Cannot revoke another user\'s session');
  }

  session.isRevoked = true;
  session.revokedAt = new Date();
  await session.save();
}
