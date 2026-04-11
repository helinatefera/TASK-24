import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { Role } from '../types/enums';
import { AuthError } from '../utils/errors';

export interface TokenPayload {
  userId: string;
  role: Role;
  jti: string;
  iat: number;
  exp: number;
}

const ABSOLUTE_EXPIRY_SECONDS = 60 * 60 * 24; // 24 hours

export function issueToken(userId: string, role: Role): { token: string; jti: string; expiresAt: Date } {
  const jti = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ABSOLUTE_EXPIRY_SECONDS;

  const token = jwt.sign(
    { userId, role, jti },
    config.jwtSecret,
    { expiresIn: ABSOLUTE_EXPIRY_SECONDS }
  );

  return {
    token,
    jti,
    expiresAt: new Date(exp * 1000),
  };
}

export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as TokenPayload;
    return decoded;
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      throw new AuthError('Token has expired');
    }
    if (err.name === 'JsonWebTokenError') {
      throw new AuthError('Invalid token');
    }
    throw new AuthError('Token verification failed');
  }
}
