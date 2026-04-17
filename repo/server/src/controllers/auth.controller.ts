import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.service';

export const registerSchema = z.object({
  username: z.string().min(3).max(50).trim(),
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(8).max(128),
  role: z.enum(['alumni', 'photographer']).optional(),
});

export const loginSchema = z.object({
  username: z.string().min(1).optional(),
  email: z.string().optional(),
  password: z.string().min(1),
});

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  path: '/',
};

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.register(req.body);
    res.cookie('session', result.token, COOKIE_OPTIONS);
    res.status(201).json({ user: result.user });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.login(req.body);
    res.cookie('session', result.token, COOKIE_OPTIONS);
    res.status(200).json({ user: result.user });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { User } = await import('../models');
    const user = await User.findById(req.user!.userId).select('-passwordHash');
    if (!user) {
      res.status(404).json({ code: 404, msg: 'User not found' });
      return;
    }
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.logout(req.user!.sessionId, req.user!.userId);
    res.clearCookie('session', { path: '/' });
    res.status(200).json({ msg: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}
