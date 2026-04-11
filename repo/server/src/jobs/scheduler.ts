import cron from 'node-cron';
import { expireAccessRequests } from './accessRequestExpiry';
import { lockWorkEntries } from './workEntryLocking';
import { cleanupNonces } from './nonceCleanup';
import { recheckConsents } from './consentRecheck';
import { logger } from '../utils/logger';

export function startScheduler(): void {
  // Every hour: expire access requests
  cron.schedule('0 * * * *', async () => {
    try {
      await expireAccessRequests();
    } catch (err) {
      logger.error('Access request expiry job failed', { error: err });
    }
  });

  // Every hour: lock fully confirmed work entries after 48h
  cron.schedule('30 * * * *', async () => {
    try {
      await lockWorkEntries();
    } catch (err) {
      logger.error('Work entry locking job failed', { error: err });
    }
  });

  // Every 10 minutes: cleanup nonces (safety net for TTL)
  cron.schedule('*/10 * * * *', async () => {
    try {
      await cleanupNonces();
    } catch (err) {
      logger.error('Nonce cleanup job failed', { error: err });
    }
  });

  // Daily at midnight: check consent re-requirements
  cron.schedule('0 0 * * *', async () => {
    try {
      await recheckConsents();
    } catch (err) {
      logger.error('Consent recheck job failed', { error: err });
    }
  });

  logger.info('Scheduled jobs registered');
}
