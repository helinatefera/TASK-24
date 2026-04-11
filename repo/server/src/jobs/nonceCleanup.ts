import { Nonce } from '../models/Nonce';
import { logger } from '../utils/logger';

export async function cleanupNonces(): Promise<void> {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000);
  const result = await Nonce.deleteMany({ createdAt: { $lte: cutoff } });
  if (result.deletedCount > 0) {
    logger.info(`Cleaned up ${result.deletedCount} expired nonces`);
  }
}
