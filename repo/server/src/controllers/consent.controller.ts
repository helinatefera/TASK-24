import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as consentService from '../services/consent.service';
import * as dataCategoryConsentService from '../services/dataCategoryConsent.service';
import { DATA_CATEGORIES } from '../utils/constants';

export const recordConsentSchema = z.object({
  policyVersion: z.string().min(1),
  accepted: z.boolean().optional(),
});

export const dataCategoryConsentSchema = z.object({
  category: z.enum(DATA_CATEGORIES as unknown as [string, ...string[]]),
  granted: z.boolean().optional().default(true),
});

export const deleteCategoryParamSchema = z.object({
  category: z.enum(DATA_CATEGORIES as unknown as [string, ...string[]]),
});

export async function recordConsent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const consent = await consentService.recordConsent({
      userId: req.user!.userId,
      policyVersion: req.body.policyVersion,
      purposes: req.body.purposes || [{ purpose: 'general', consented: req.body.accepted !== undefined ? req.body.accepted : true }],
    });
    res.status(201).json(consent);
  } catch (err) {
    next(err);
  }
}

export async function getConsentHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const history = await consentService.getConsentHistory(req.user!.userId);
    res.status(200).json(history);
  } catch (err) {
    next(err);
  }
}

export async function checkConsentCurrent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await consentService.checkConsentCurrent(req.user!.userId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getDataCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json({ categories: [...DATA_CATEGORIES] });
  } catch (err) {
    next(err);
  }
}

export async function getPolicyHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const history = await consentService.getPolicyHistory();
    res.status(200).json(history);
  } catch (err) {
    next(err);
  }
}

function normalizeCategoryConsent(doc: any) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  obj.category = obj.dataCategory;
  return obj;
}

export async function recordDataCategoryConsent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await dataCategoryConsentService.recordConsent({
      userId: req.user!.userId,
      dataCategory: req.body.category,
      disclosureText: req.body.disclosureText || '',
      purposeDescription: req.body.purposeDescription || '',
    });
    res.status(201).json(normalizeCategoryConsent(result));
  } catch (err) {
    next(err);
  }
}

export async function getCategoryConsents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const consents = await dataCategoryConsentService.getActiveConsents(req.user!.userId);
    res.status(200).json(consents.map(normalizeCategoryConsent));
  } catch (err) {
    next(err);
  }
}

export async function revokeDataCategoryConsent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await dataCategoryConsentService.revokeConsent(req.user!.userId, req.params.category);
    res.status(200).json(normalizeCategoryConsent(result));
  } catch (err) {
    next(err);
  }
}
