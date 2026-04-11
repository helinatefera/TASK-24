import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as privacyService from '../services/privacy.service';

const privacyLevelEnum = z.enum(['public', 'alumni_only', 'private']);

export const updatePrivacySettingsSchema = z.object({
  // Accept the flat shape or the { fieldPrivacy: {...} } wrapper
  fieldPrivacy: z.record(z.string(), privacyLevelEnum).optional(),
  firstName: privacyLevelEnum.optional(),
  lastName: privacyLevelEnum.optional(),
  email: privacyLevelEnum.optional(),
  phone: privacyLevelEnum.optional(),
  location: privacyLevelEnum.optional(),
  employer: privacyLevelEnum.optional(),
  bio: privacyLevelEnum.optional(),
  graduationYear: privacyLevelEnum.optional(),
});

export async function getPrivacySettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const settings = await privacyService.getPrivacySettings(req.user!.userId);
    res.status(200).json(settings);
  } catch (err) {
    next(err);
  }
}

export async function updatePrivacySettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Unwrap the fieldPrivacy envelope if present; otherwise use body directly
    const raw = req.body.fieldPrivacy || req.body;
    // Strip non-field keys (like fieldPrivacy itself) to get a clean Record<field, level>
    const allowedFields = ['firstName', 'lastName', 'email', 'phone', 'location', 'employer', 'bio', 'graduationYear'];
    const settings: Record<string, string> = {};
    for (const key of allowedFields) {
      if (raw[key]) settings[key] = raw[key];
    }
    const result = await privacyService.updatePrivacySettings(req.user!.userId, settings as any);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
