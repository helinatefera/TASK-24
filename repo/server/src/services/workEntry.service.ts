import { WorkEntry, Job } from '../models';
import { WorkEntryType, JobStatus } from '../types/enums';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { calculateTimeEntryCents, calculatePieceRateCents } from '../utils/money';
import { TIMESHEET_INCREMENT_MINUTES, LOCK_HOURS } from '../utils/constants';

export interface CreateWorkEntryInput {
  jobId: string;
  photographerId: string;
  entryType: WorkEntryType;
  date?: Date;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  itemDescription?: string;
  quantity?: number;
  unitRateCents?: number;
  notes?: string;
}

/**
 * Create a work entry. For TIME entries, validate 15-minute alignment.
 */
export async function createWorkEntry(input: CreateWorkEntryInput) {
  const job = await Job.findById(input.jobId);
  if (!job) {
    throw new NotFoundError('Job not found');
  }

  if (
    job.status !== JobStatus.IN_PROGRESS &&
    job.status !== JobStatus.REVIEW
  ) {
    throw new ValidationError('Work entries can only be added to in-progress or review jobs');
  }

  if (job.photographerId?.toString() !== input.photographerId) {
    throw new ForbiddenError('Only the assigned photographer can create work entries');
  }

  let subtotalCents: number;

  if (input.entryType === WorkEntryType.TIME) {
    if (!input.durationMinutes || input.durationMinutes <= 0) {
      throw new ValidationError('Duration in minutes is required for time entries');
    }

    // Validate 15-minute alignment
    if (input.durationMinutes % TIMESHEET_INCREMENT_MINUTES !== 0) {
      throw new ValidationError(
        `Duration must be in ${TIMESHEET_INCREMENT_MINUTES}-minute increments`
      );
    }

    subtotalCents = calculateTimeEntryCents(job.agreedRateCents, input.durationMinutes);
  } else {
    // PIECE_RATE
    if (!input.quantity || input.quantity <= 0) {
      throw new ValidationError('Quantity is required for piece rate entries');
    }

    const unitRate = input.unitRateCents ?? job.agreedRateCents;
    subtotalCents = calculatePieceRateCents(unitRate, input.quantity);
  }

  const entry = await WorkEntry.create({
    jobId: input.jobId,
    photographerId: input.photographerId,
    entryType: input.entryType,
    date: input.date || new Date(),
    startTime: input.startTime,
    endTime: input.endTime,
    durationMinutes: input.durationMinutes,
    itemDescription: input.itemDescription,
    quantity: input.quantity,
    unitRateCents: input.unitRateCents,
    subtotalCents,
    notes: input.notes,
    isLocked: false,
  });

  return entry;
}

/**
 * Edit a work entry. Resets both confirmations.
 */
export async function editWorkEntry(
  entryId: string,
  userId: string,
  updates: Partial<CreateWorkEntryInput>
) {
  const entry = await WorkEntry.findById(entryId);
  if (!entry) {
    throw new NotFoundError('Work entry not found');
  }

  if (entry.isLocked) {
    throw new ValidationError('Cannot edit a locked work entry');
  }

  if (entry.photographerId.toString() !== userId) {
    throw new ForbiddenError('Only the photographer can edit their work entries');
  }

  // If duration is being updated, validate alignment
  if (updates.durationMinutes !== undefined) {
    if (updates.durationMinutes % TIMESHEET_INCREMENT_MINUTES !== 0) {
      throw new ValidationError(
        `Duration must be in ${TIMESHEET_INCREMENT_MINUTES}-minute increments`
      );
    }
  }

  // Recalculate subtotal if relevant fields changed
  const job = await Job.findById(entry.jobId);
  if (!job) {
    throw new NotFoundError('Associated job not found');
  }

  const entryType = updates.entryType || entry.entryType;
  let subtotalCents = entry.subtotalCents;

  if (entryType === WorkEntryType.TIME) {
    const duration = updates.durationMinutes ?? entry.durationMinutes;
    if (duration) {
      subtotalCents = calculateTimeEntryCents(job.agreedRateCents, duration);
    }
  } else {
    const quantity = updates.quantity ?? entry.quantity;
    const unitRate = updates.unitRateCents ?? entry.unitRateCents ?? job.agreedRateCents;
    if (quantity) {
      subtotalCents = calculatePieceRateCents(unitRate, quantity);
    }
  }

  // Apply updates and reset confirmations
  Object.assign(entry, updates, {
    subtotalCents,
    clientConfirmedAt: undefined,
    photographerConfirmedAt: undefined,
    lockAt: undefined,
  });

  // Use $unset for clearing confirmation dates
  await WorkEntry.findByIdAndUpdate(entryId, {
    $set: {
      ...updates,
      subtotalCents,
    },
    $unset: {
      clientConfirmedAt: 1,
      photographerConfirmedAt: 1,
      lockAt: 1,
    },
  });

  return WorkEntry.findById(entryId);
}

/**
 * Confirm a work entry (bilateral confirmation).
 * Client or photographer can confirm.
 * Once both confirm, set lockAt = now + 48h.
 */
export async function confirmWorkEntry(entryId: string, userId: string) {
  const entry = await WorkEntry.findById(entryId);
  if (!entry) {
    throw new NotFoundError('Work entry not found');
  }

  if (entry.isLocked) {
    throw new ValidationError('Work entry is already locked');
  }

  const job = await Job.findById(entry.jobId);
  if (!job) {
    throw new NotFoundError('Associated job not found');
  }

  const isClient = job.clientId.toString() === userId;
  const isPhotographer = entry.photographerId.toString() === userId;

  if (!isClient && !isPhotographer) {
    throw new ForbiddenError('Only the client or photographer can confirm work entries');
  }

  if (isClient) {
    if (entry.clientConfirmedAt) {
      throw new ValidationError('Client has already confirmed this entry');
    }
    entry.clientConfirmedAt = new Date();
  }

  if (isPhotographer) {
    if (entry.photographerConfirmedAt) {
      throw new ValidationError('Photographer has already confirmed this entry');
    }
    entry.photographerConfirmedAt = new Date();
  }

  // If both confirmed, schedule lock
  if (entry.clientConfirmedAt && entry.photographerConfirmedAt) {
    const lockAt = new Date();
    lockAt.setHours(lockAt.getHours() + LOCK_HOURS);
    entry.lockAt = lockAt;
  }

  await entry.save();
  return entry;
}

/**
 * Lock a work entry after 48h from fully confirmed.
 */
export async function lockWorkEntry(entryId: string) {
  const entry = await WorkEntry.findById(entryId);
  if (!entry) {
    throw new NotFoundError('Work entry not found');
  }

  if (entry.isLocked) {
    return entry; // Already locked, idempotent
  }

  if (!entry.clientConfirmedAt || !entry.photographerConfirmedAt) {
    throw new ValidationError('Work entry must be fully confirmed before locking');
  }

  if (!entry.lockAt || new Date() < entry.lockAt) {
    throw new ValidationError(
      `Work entry cannot be locked until ${LOCK_HOURS}h after both parties confirm`
    );
  }

  entry.isLocked = true;
  entry.lockedAt = new Date();
  await entry.save();
  return entry;
}

export async function getWorkEntriesByJob(jobId: string, requesterId: string) {
  const job = await Job.findById(jobId);
  if (!job) throw new NotFoundError('Job not found');

  const { User } = await import('../models');
  const requester = await User.findById(requesterId);
  if (requester?.role !== 'admin') {
    const isParticipant =
      job.clientId.toString() === requesterId ||
      (job.photographerId && job.photographerId.toString() === requesterId);
    if (!isParticipant) {
      throw new ForbiddenError('Only job participants can view work entries');
    }
  }

  return WorkEntry.find({ jobId }).sort({ date: 1, createdAt: 1 }).lean();
}
