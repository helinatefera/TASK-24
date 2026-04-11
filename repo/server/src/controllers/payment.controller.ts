import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as paymentService from '../services/payment.service';

export const recordPaymentSchema = z.object({
  amountCents: z.number().int().nonnegative(),
  method: z.enum(['cash', 'check', 'bank_transfer', 'other']),
  reference: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  paidAt: z.string().optional(),
});

export const settlementIdParamSchema = z.object({
  id: z.string().min(1),
});

export async function recordPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payment = await paymentService.recordPayment({
      settlementId: req.params.id,
      amountCents: req.body.amountCents,
      method: req.body.method,
      receiptDetails: {
        referenceNumber: req.body.reference,
        date: req.body.paidAt ? new Date(req.body.paidAt) : undefined,
        notes: req.body.notes,
        attachmentId: req.body.attachmentId,
      },
      recordedBy: req.user!.userId,
    });
    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
}

export async function getBySettlement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payments = await paymentService.getPaymentsBySettlement(req.params.id, req.user!.userId);
    res.status(200).json(payments);
  } catch (err) {
    next(err);
  }
}
