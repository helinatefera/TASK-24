import { Request, Response, NextFunction } from 'express';
import { AuditLog } from '../models/AuditLog';

export function auditLogger(req: Request, res: Response, next: NextFunction): void {
  const originalEnd = res.end.bind(res);
  (res as any).end = function (...args: any[]) {
    const statusCode = res.statusCode;
    if (req.user && (statusCode >= 400 || isSecurityRelevant(req))) {
      AuditLog.create({
        timestamp: new Date(),
        actorId: req.user.userId,
        actorRole: req.user.role,
        action: `${req.method}:${req.path}`,
        resource: req.path.split('/')[2] || 'unknown',
        details: { statusCode, method: req.method },
        ipAddress: req.ip,
        deviceFingerprint: req.deviceFingerprint,
        outcome: statusCode < 400 ? 'success' : 'failure',
        requestId: req.requestId,
      }).catch(() => {});
    }
    return originalEnd(...args);
  };
  next();
}

function isSecurityRelevant(req: Request): boolean {
  const path = req.path;
  return path.includes('/auth/') ||
    path.includes('/admin/') ||
    path.includes('/verification/') ||
    path.includes('/export/') ||
    path.includes('/blacklist') ||
    req.method === 'DELETE';
}
