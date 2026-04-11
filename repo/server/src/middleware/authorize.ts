import { Request, Response, NextFunction } from 'express';
import { Role } from '../types/enums';
import { ForbiddenError, AuthError } from '../utils/errors';

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthError('Authentication required'));
    }
    if (roles.length > 0 && !roles.includes(req.user.role as Role)) {
      return next(new ForbiddenError('Insufficient permissions'));
    }
    next();
  };
}
