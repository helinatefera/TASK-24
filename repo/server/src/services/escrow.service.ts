import { EscrowLedger, Job, User } from '../models';
import { EscrowEntryType } from '../types/enums';
import { NotFoundError, ForbiddenError } from '../utils/errors';

async function assertJobParticipant(jobId: string, requesterId: string): Promise<void> {
  const job = await Job.findById(jobId);
  if (!job) throw new NotFoundError('Job not found');
  const requester = await User.findById(requesterId);
  if (requester?.role !== 'admin') {
    const isParticipant =
      job.clientId.toString() === requesterId ||
      (job.photographerId && job.photographerId.toString() === requesterId);
    if (!isParticipant) {
      throw new ForbiddenError('Only job participants can access escrow records');
    }
  }
}

export async function addEntry(jobId: string, entryType: EscrowEntryType, amountCents: number, description: string, recordedBy: string) {
  await assertJobParticipant(jobId, recordedBy);
  const lastEntry = await EscrowLedger.findOne({ jobId }).sort({ createdAt: -1 });
  const prevBalance = lastEntry ? lastEntry.balanceCents : 0;
  let newBalance: number;
  if (entryType === EscrowEntryType.DEPOSIT) newBalance = prevBalance + amountCents;
  else if (entryType === EscrowEntryType.RELEASE || entryType === EscrowEntryType.REFUND) newBalance = prevBalance - amountCents;
  else newBalance = prevBalance + amountCents;

  return EscrowLedger.create({ jobId, entryType, amountCents, balanceCents: newBalance, description, recordedBy });
}

export async function getByJob(jobId: string, requesterId: string) {
  await assertJobParticipant(jobId, requesterId);
  return EscrowLedger.find({ jobId }).sort({ createdAt: 1 });
}
