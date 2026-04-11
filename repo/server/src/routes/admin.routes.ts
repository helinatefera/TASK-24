import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authorize } from '../middleware/authorize';
import { validateRequest } from '../middleware/validateRequest';
import { Role } from '../types/enums';
import { User, Blacklist, PrivacyPolicy } from '../models';
import { AuditLog } from '../models/AuditLog';
import { AUDIT_EVENTS } from '../utils/constants';
import * as reportService from '../services/report.service';

const roleChangeSchema = z.object({ role: z.enum(['alumni', 'photographer', 'admin']) });
const statusChangeSchema = z.object({ accountStatus: z.enum(['active', 'suspended', 'banned', 'deleted']) });
const blacklistCreateSchema = z.object({
  targetType: z.enum(['account', 'device']),
  targetId: z.string().min(1),
  reason: z.string().min(1).max(1000),
});
const idParamSchema = z.object({ id: z.string().min(1) });
const privacyPolicyCreateSchema = z.object({
  version: z.string().min(1),
  content: z.string().min(1),
  effectiveDate: z.string().min(1),
  purposes: z.array(z.string()).optional(),
});
const reportReviewSchema = z.object({
  status: z.enum(['under_review', 'needs_more_info', 'action_taken', 'rejected', 'closed']),
  notes: z.string().max(2000).optional(),
  resolution: z.string().max(2000).optional(),
});

const router = Router();

router.get('/users', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const users = await User.find().skip((page - 1) * limit).limit(limit).select('-passwordHash');
    const total = await User.countDocuments();
    res.json({ items: users, total, page, limit });
  } catch (err) { next(err); }
});

router.patch('/users/:id/role', authorize(Role.ADMIN), validateRequest(roleChangeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { role: req.body.role }, { new: true }).select('-passwordHash');
    await AuditLog.create({ timestamp: new Date(), actorId: req.user!.userId, action: AUDIT_EVENTS.ROLE_CHANGE, resource: 'user', resourceId: req.params.id, details: { newRole: req.body.role }, outcome: 'success' });
    res.json(user);
  } catch (err) { next(err); }
});

router.patch('/users/:id/status', authorize(Role.ADMIN), validateRequest(statusChangeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { accountStatus: req.body.accountStatus }, { new: true }).select('-passwordHash');
    await AuditLog.create({ timestamp: new Date(), actorId: req.user!.userId, action: AUDIT_EVENTS.PERMISSION_CHANGE, resource: 'user', resourceId: req.params.id, details: { newStatus: req.body.accountStatus }, outcome: 'success' });
    res.json(user);
  } catch (err) { next(err); }
});

router.post('/blacklist', authorize(Role.ADMIN), validateRequest(blacklistCreateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await Blacklist.create({ ...req.body, blacklistedBy: req.user!.userId });
    await AuditLog.create({ timestamp: new Date(), actorId: req.user!.userId, action: AUDIT_EVENTS.BLACKLIST_ADD, resource: 'blacklist', resourceId: entry._id!.toString(), outcome: 'success' });
    res.status(201).json(entry);
  } catch (err) { next(err); }
});

router.delete('/blacklist/:id', authorize(Role.ADMIN), validateRequest(idParamSchema, 'params'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await Blacklist.findByIdAndDelete(req.params.id);
    await AuditLog.create({ timestamp: new Date(), actorId: req.user!.userId, action: AUDIT_EVENTS.BLACKLIST_REMOVE, resource: 'blacklist', resourceId: req.params.id, outcome: 'success' });
    res.json({ msg: 'Blacklist entry removed' });
  } catch (err) { next(err); }
});

router.post('/privacy-policies', authorize(Role.ADMIN), validateRequest(privacyPolicyCreateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prev = await PrivacyPolicy.findOne().sort({ effectiveDate: -1 });
    const newPurposes = req.body.purposes || [];
    const prevPurposes = prev ? prev.purposes : [];
    const newPurposesIntroduced = newPurposes.filter((p: string) => !prevPurposes.includes(p));
    const policy = await PrivacyPolicy.create({ ...req.body, newPurposesIntroduced, createdBy: req.user!.userId });
    res.status(201).json(policy);
  } catch (err) { next(err); }
});

router.get('/privacy-policies', authorize(Role.ADMIN), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const policies = await PrivacyPolicy.find().sort({ effectiveDate: -1 });
    res.json(policies);
  } catch (err) { next(err); }
});

router.get('/reports', authorize(Role.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await reportService.getAllReports(page);
    res.json(result);
  } catch (err) { next(err); }
});

router.patch('/reports/:id', authorize(Role.ADMIN), validateRequest(idParamSchema, 'params'), validateRequest(reportReviewSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await reportService.reviewReport(req.params.id, req.user!.userId, req.body.status, req.body.notes, req.body.resolution);
    res.json(report);
  } catch (err) { next(err); }
});

export default router;
