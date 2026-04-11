import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as settlementService from '../services/settlement.service';
import * as exportService from '../services/export.service';

export const generateSettlementSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export const addAdjustmentSchema = z.object({
  type: z.enum(['discount', 'surcharge', 'correction', 'refund_adjustment']).optional().default('correction'),
  amount: z.number().optional(),
  amountCents: z.number().optional(),
  description: z.string().min(1).max(500).optional(),
  reason: z.string().min(1).max(500).optional(),
}).refine(data => (data.amount !== undefined || data.amountCents !== undefined), {
  message: 'Either amount or amountCents is required',
}).refine(data => (data.description || data.reason), {
  message: 'Either description or reason is required',
});

export const jobIdParamSchema = z.object({
  jobId: z.string().min(1),
});

export const settlementIdParamSchema = z.object({
  id: z.string().min(1),
});

export async function generate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const settlement = await settlementService.generateSettlement(
      req.params.jobId,
      req.user!.userId,
    );
    res.status(201).json(settlement);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const settlement = await settlementService.getSettlement(req.params.id, req.user!.userId);
    res.status(200).json(settlement);
  } catch (err) {
    next(err);
  }
}

export async function approve(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const settlement = await settlementService.finalizeSettlement(
      req.params.id,
      req.user!.userId,
      req.body?.varianceReason,
    );
    res.status(200).json(settlement);
  } catch (err) {
    next(err);
  }
}

export async function addAdjustment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const settlement = await settlementService.addAdjustment(
      req.params.id,
      req.body.type || 'correction',
      req.body.amountCents ?? req.body.amount,
      req.body.description || req.body.reason,
      req.user!.userId,
    );
    res.status(201).json(settlement);
  } catch (err) {
    next(err);
  }
}

export async function exportPDF(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pdfBuffer = await exportService.exportSettlementPDF(req.params.id, req.user!.userId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=settlement-${req.params.id}.pdf`);
    res.status(200).send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

export async function exportCSV(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const csvData = await exportService.exportSettlementCSV(req.params.id, req.user!.userId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=settlement-${req.params.id}.csv`);
    res.status(200).send(csvData);
  } catch (err) {
    next(err);
  }
}
