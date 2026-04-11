import { Payment, Settlement, User } from '../models';
import { SettlementStatus, PaymentMethod } from '../types/enums';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';

async function assertSettlementParticipant(settlement: any, actorId: string): Promise<void> {
  const actor = await User.findById(actorId);
  if (actor?.role === 'admin') return;
  const isParticipant =
    settlement.clientId.toString() === actorId ||
    settlement.photographerId.toString() === actorId;
  if (!isParticipant) {
    throw new ForbiddenError('Only settlement participants or admins can record payments');
  }
}

export interface RecordPaymentInput {
  settlementId: string;
  amountCents: number;
  method: PaymentMethod;
  receiptDetails: {
    referenceNumber?: string;
    date?: Date;
    notes?: string;
    attachmentId?: string;
  };
  recordedBy: string;
}

export async function recordPayment(input: RecordPaymentInput) {
  const settlement = await Settlement.findById(input.settlementId);
  if (!settlement) {
    throw new NotFoundError('Settlement not found');
  }

  await assertSettlementParticipant(settlement, input.recordedBy);

  if (settlement.status !== SettlementStatus.APPROVED) {
    throw new ValidationError(
      `Cannot record payment for a settlement with status: ${settlement.status}. Must be approved.`
    );
  }

  if (input.amountCents <= 0) {
    throw new ValidationError('Payment amount must be positive');
  }

  const payment = await Payment.create({
    settlementId: input.settlementId,
    amountCents: input.amountCents,
    method: input.method,
    receiptDetails: {
      referenceNumber: input.receiptDetails.referenceNumber,
      date: input.receiptDetails.date || new Date(),
      notes: input.receiptDetails.notes,
      attachmentId: input.receiptDetails.attachmentId,
    },
    paidAt: new Date(),
    recordedBy: input.recordedBy,
  });

  // Check if total paid matches or exceeds settlement
  const allPayments = await Payment.find({ settlementId: input.settlementId }).lean();
  const totalPaid = allPayments.reduce((sum, p) => sum + p.amountCents, 0);

  if (totalPaid >= settlement.finalAmountCents) {
    settlement.status = SettlementStatus.PAID;
    await settlement.save();
  }

  return payment;
}

export async function getPaymentsBySettlement(settlementId: string, requesterId: string) {
  const { User } = await import('../models');
  const requester = await User.findById(requesterId);
  const requesterRole = requester?.role;

  if (requesterRole !== 'admin') {
    const settlement = await Settlement.findById(settlementId);
    if (!settlement) throw new NotFoundError('Settlement not found');
    const isParticipant = settlement.clientId.toString() === requesterId || settlement.photographerId.toString() === requesterId;
    if (!isParticipant) throw new ForbiddenError('You do not have access to these payments');
  }
  return Payment.find({ settlementId }).sort({ paidAt: -1 }).lean();
}
