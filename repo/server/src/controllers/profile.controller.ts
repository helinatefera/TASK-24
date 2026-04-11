import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as profileService from '../services/profile.service';

export const updateProfileSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(1000).optional(),
  location: z.string().max(200).optional(),
  website: z.string().url().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  employer: z.string().max(200).optional(),
  graduationYear: z.number().int().optional(),
  specialties: z.array(z.string()).optional(),
  contactInfo: z.object({
    phone: z.string().optional(),
    publicEmail: z.string().email().optional(),
  }).optional(),
});

export const getProfilesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.enum(['alumni', 'photographer']).optional(),
});

export const profileIdParamSchema = z.object({
  id: z.string().min(1),
});

export async function getMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await profileService.getProfileByUserId(req.user!.userId);
    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
}

export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await profileService.getProfileWithPrivacy(
      req.params.id,
      {
        userId: req.user!.userId,
        role: req.user!.role,
        isAlumni: req.user!.role === 'alumni',
        communityId: req.user!.communityId || '',
      },
    );
    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
}

export async function updateMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await profileService.updateProfile(req.user!.userId, req.body);
    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
}

export async function getProfiles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Scope profile list by community for non-admins
    const filters: any = { ...req.query };
    if (req.user!.role !== 'admin') {
      filters.communityId = req.user!.communityId;
    }
    const result = await profileService.getAllProfiles(filters);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
