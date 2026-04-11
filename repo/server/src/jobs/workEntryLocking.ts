import { WorkEntry } from '../models/WorkEntry';
import { logger } from '../utils/logger';
import { LOCK_HOURS } from '../utils/constants';

export async function lockWorkEntries(): Promise<void> {
  // lockAt is already set to (confirmation time + 48h) by confirmWorkEntry.
  // We lock entries whose lockAt has passed — i.e. lockAt <= now.
  const now = new Date();

  const result = await WorkEntry.updateMany(
    {
      isLocked: false,
      clientConfirmedAt: { $exists: true, $ne: null },
      photographerConfirmedAt: { $exists: true, $ne: null },
      lockAt: { $lte: now },
    },
    {
      $set: { isLocked: true, lockedAt: new Date() },
    }
  );

  if (result.modifiedCount > 0) {
    logger.info(`Locked ${result.modifiedCount} work entries`);
  }
}
