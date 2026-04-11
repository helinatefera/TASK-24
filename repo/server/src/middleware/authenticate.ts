import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { Session } from '../models/Session';
import { User } from '../models/User';
import { AuthError } from '../utils/errors';
import { AccountStatus } from '../types/enums';

const PUBLIC_PATHS = [
  'POST:/api/auth/register',
  'POST:/api/auth/login',
  'GET:/api/health',
];

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const routeKey = `${req.method}:${req.path}`;
  if (PUBLIC_PATHS.includes(routeKey)) {
    return next();
  }

  try {
    // Read token from httpOnly cookie first, fall back to Authorization header
    let token: string | undefined;
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      const sessionCookie = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('session='));
      if (sessionCookie) token = sessionCookie.split('=')[1];
    }
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      }
    }
    if (!token) {
      return next(new AuthError('Missing authentication'));
    }
    let payload: any;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      return next(new AuthError('Invalid or expired token'));
    }

    const session = await Session.findOne({ jti: payload.jti });
    if (!session || session.isRevoked) {
      return next(new AuthError('Session revoked or expired'));
    }

    const now = new Date();
    if (now > session.absoluteExpiry) {
      return next(new AuthError('Session expired'));
    }

    const idleMs = now.getTime() - session.lastActivityAt.getTime();
    if (idleMs > config.idleTimeoutMs) {
      return next(new AuthError('Session idle timeout'));
    }

    const user = await User.findById(payload.userId);
    if (!user || user.accountStatus !== AccountStatus.ACTIVE) {
      return next(new AuthError('Account not active'));
    }

    session.lastActivityAt = now;
    await session.save();

    req.user = {
      userId: payload.userId,
      role: user.role,
      sessionId: payload.jti,
      isAlumni: user.isAlumni,
      communityId: user.communityId,
      accountStatus: user.accountStatus,
    };

    next();
  } catch (err) {
    next(err);
  }
}
