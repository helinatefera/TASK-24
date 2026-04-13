import { Job } from '../models';
import { JobStatus } from '../types/enums';
import { renderTemplate } from '../services/notification.service';
import { logger } from '../utils/logger';

/**
 * Send booking reminders for event-type jobs happening in the next 24 hours.
 *
 * Template contract: the booking_reminder template expects `event_time` (DateTime).
 * This job sends `event_time` sourced from job.eventDate — NOT `starts_at`.
 * Both the template placeholder and the data key must stay in sync as `event_time`.
 */
export async function sendBookingReminders(): Promise<void> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const upcomingJobs = await Job.find({
    jobType: 'event',
    status: { $in: [JobStatus.ASSIGNED, JobStatus.IN_PROGRESS] },
    eventDate: { $gte: now, $lte: in24h },
  }).lean();

  let sent = 0;
  for (const job of upcomingJobs) {
    if (!job.eventDate) continue;

    const body = renderTemplate('booking_reminder', {
      job_title: job.title,
      event_time: job.eventDate,   // DateTime — formatted by renderTemplate
    });

    // In a production system this would dispatch via email/push/SMS.
    // For now we log the rendered notification; the delivery transport is
    // pluggable and outside the scope of the template-fix audit item.
    logger.info('Booking reminder rendered', {
      jobId: job._id.toString(),
      photographerId: job.photographerId?.toString(),
      clientId: job.clientId.toString(),
      body,
    });

    sent++;
  }

  if (sent > 0) {
    logger.info(`Sent ${sent} booking reminder(s)`);
  }
}
