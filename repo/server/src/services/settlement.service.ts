import { Settlement, SettlementLineItem, WorkEntry, Job, User } from '../models';
import { SettlementStatus, LineItemType, AdjustmentType, WorkEntryType } from '../types/enums';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { addCents, varianceCheck } from '../utils/money';
import { beforeSettlementFinalize } from '../hooks/complianceHooks';

async function assertSettlementParticipant(settlement: any, actorId: string): Promise<void> {
  const actor = await User.findById(actorId);
  if (actor?.role === 'admin') return;
  const isParticipant =
    settlement.clientId.toString() === actorId ||
    settlement.photographerId.toString() === actorId;
  if (!isParticipant) {
    throw new ForbiddenError('Only settlement participants or admins can perform this action');
  }
}

/**
 * Generate a settlement by aggregating locked work entries for a job.
 */
export async function generateSettlement(jobId: string, generatedBy: string) {
  const job = await Job.findById(jobId);
  if (!job) {
    throw new NotFoundError('Job not found');
  }

  // Only job client, assigned photographer, or admin may generate a settlement
  const actor = await User.findById(generatedBy);
  if (actor?.role !== 'admin') {
    const isParticipant =
      job.clientId.toString() === generatedBy ||
      (job.photographerId && job.photographerId.toString() === generatedBy);
    if (!isParticipant) {
      throw new ForbiddenError('Only job participants or admins can generate settlements');
    }
  }

  if (!job.photographerId) {
    throw new ValidationError('Job has no assigned photographer');
  }

  // Get locked work entries
  const entries = await WorkEntry.find({ jobId, isLocked: true }).lean();

  if (entries.length === 0) {
    throw new ValidationError('No locked work entries to settle');
  }

  // Calculate subtotal
  let subtotalCents = 0;
  for (const entry of entries) {
    subtotalCents = addCents(subtotalCents, entry.subtotalCents);
  }

  const settlement = await Settlement.create({
    jobId,
    photographerId: job.photographerId,
    clientId: job.clientId,
    status: SettlementStatus.DRAFT,
    subtotalCents,
    adjustmentCents: 0,
    finalAmountCents: subtotalCents,
  });

  // Create line items for each work entry
  const lineItems = [];
  for (const entry of entries) {
    const lineItemType =
      entry.entryType === WorkEntryType.TIME
        ? LineItemType.TIMESHEET
        : LineItemType.PIECE_RATE;

    const description =
      entry.entryType === WorkEntryType.TIME
        ? `Time entry: ${entry.durationMinutes} min on ${entry.date ? new Date(entry.date).toISOString().split('T')[0] : 'N/A'}`
        : `Piece rate: ${entry.quantity} x ${entry.itemDescription || 'items'}`;

    const lineItem = await SettlementLineItem.create({
      settlementId: settlement._id,
      description,
      amountCents: entry.subtotalCents,
      type: lineItemType,
      workEntryId: entry._id,
      createdBy: generatedBy,
    });
    lineItems.push(lineItem);
  }

  return { settlement, lineItems };
}

/**
 * Add an adjustment to a settlement. Type and reason are required.
 */
export async function addAdjustment(
  settlementId: string,
  adjustmentType: AdjustmentType,
  amountCents: number,
  reason: string,
  createdBy: string
) {
  if (!reason || reason.trim().length === 0) {
    throw new ValidationError('Adjustment reason is required');
  }

  const settlement = await Settlement.findById(settlementId);
  if (!settlement) {
    throw new NotFoundError('Settlement not found');
  }

  await assertSettlementParticipant(settlement, createdBy);

  if (settlement.status !== SettlementStatus.DRAFT && settlement.status !== SettlementStatus.PENDING_REVIEW) {
    throw new ValidationError(`Cannot add adjustments to a settlement with status: ${settlement.status}`);
  }

  const description = `${adjustmentType}: ${reason}`;

  const lineItem = await SettlementLineItem.create({
    settlementId,
    description,
    amountCents,
    type: LineItemType.ADJUSTMENT,
    adjustmentType,
    adjustmentReason: reason,
    createdBy,
  });

  // Recalculate settlement totals
  settlement.adjustmentCents = addCents(settlement.adjustmentCents, amountCents);
  settlement.finalAmountCents = addCents(settlement.subtotalCents, settlement.adjustmentCents);

  // Run variance check: threshold = max(subtotal * 0.02, 2500)
  const variance = varianceCheck(settlement.subtotalCents, settlement.finalAmountCents);
  settlement.variancePercent = variance.variancePercent;
  settlement.varianceAmountCents = variance.varianceAmountCents;

  await settlement.save();

  return { settlement, lineItem };
}

/**
 * Finalize a settlement. Runs variance check and compliance hook.
 * Variance threshold = max(subtotal * 0.02, 2500).
 * If variance exceeds threshold, a varianceReason is required.
 */
export async function finalizeSettlement(
  settlementId: string,
  finalizedBy: string,
  varianceReason?: string
) {
  const settlement = await Settlement.findById(settlementId);
  if (!settlement) {
    throw new NotFoundError('Settlement not found');
  }

  await assertSettlementParticipant(settlement, finalizedBy);

  if (settlement.status !== SettlementStatus.DRAFT && settlement.status !== SettlementStatus.PENDING_REVIEW) {
    throw new ValidationError(`Cannot finalize a settlement with status: ${settlement.status}`);
  }

  // Run variance check
  const variance = varianceCheck(settlement.subtotalCents, settlement.finalAmountCents);

  if (variance.requiresReason) {
    if (!varianceReason || varianceReason.trim().length === 0) {
      throw new ValidationError(
        `Variance of ${variance.varianceAmountCents} cents exceeds threshold of ${variance.threshold} cents. A variance reason is required.`
      );
    }
    settlement.varianceReason = varianceReason;
  }

  settlement.variancePercent = variance.variancePercent;
  settlement.varianceAmountCents = variance.varianceAmountCents;

  // Run compliance hook
  const complianceResult = await beforeSettlementFinalize(settlement.toObject());
  if (!complianceResult.allow) {
    throw new ForbiddenError(
      complianceResult.reason || 'Compliance check failed for settlement finalization'
    );
  }

  settlement.status = SettlementStatus.APPROVED;
  await settlement.save();

  return settlement;
}

export async function getSettlement(settlementId: string, requesterId: string) {
  const settlement = await Settlement.findById(settlementId);
  if (!settlement) {
    throw new NotFoundError('Settlement not found');
  }

  // Look up the requester's role from DB — never trust caller-supplied role
  const { User } = await import('../models');
  const requester = await User.findById(requesterId);
  const requesterRole = requester?.role;

  // Object-level authorization: only participants or admins
  if (requesterRole !== 'admin') {
    const isParticipant =
      settlement.clientId.toString() === requesterId ||
      settlement.photographerId.toString() === requesterId;
    if (!isParticipant) {
      throw new ForbiddenError('You do not have access to this settlement');
    }
  }

  const lineItems = await SettlementLineItem.find({ settlementId }).sort({ createdAt: 1 }).lean();

  return { settlement, lineItems };
}

export async function getSettlementsByJob(jobId: string) {
  return Settlement.find({ jobId }).sort({ createdAt: -1 }).lean();
}
