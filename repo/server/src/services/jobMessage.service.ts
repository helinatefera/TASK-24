import { JobMessage, Job } from '../models';
import { ContentReviewStatus, Role } from '../types/enums';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';
import { scanText } from '../middleware/contentFilter';

export interface SendMessageInput {
  jobId: string;
  senderId: string;
  messageText: string;
}

/**
 * Send a message on a job. Runs content filter — if flagged words found,
 * message is created with PENDING review status.
 */
export async function sendMessage(input: SendMessageInput) {
  const job = await Job.findById(input.jobId);
  if (!job) {
    throw new NotFoundError('Job not found');
  }

  // Verify sender is a participant
  const isParticipant =
    job.clientId.toString() === input.senderId ||
    (job.photographerId && job.photographerId.toString() === input.senderId);

  if (!isParticipant) {
    throw new ForbiddenError('Only job participants can send messages');
  }

  // Run content filter
  const filterResult = scanText(input.messageText);
  const reviewStatus = filterResult.isClean
    ? ContentReviewStatus.APPROVED
    : ContentReviewStatus.PENDING;

  const message = await JobMessage.create({
    jobId: input.jobId,
    senderId: input.senderId,
    messageText: input.messageText,
    reviewStatus,
    flaggedWords: filterResult.matchedWords,
  });

  // If flagged, create a ContentReview record for the admin queue
  if (!filterResult.isClean) {
    const { submitForReview } = await import('./contentReview.service');
    const { ReviewableContentType } = await import('../types/enums');
    await submitForReview(ReviewableContentType.JOB_MESSAGE, message._id.toString(), input.senderId, filterResult.matchedWords);
  }

  return message;
}

/**
 * List messages for a job.
 * Messages with PENDING review status are only visible to the sender.
 */
export async function listMessages(
  jobId: string,
  viewerId: string,
  page = 1,
  limit = 50
) {
  const job = await Job.findById(jobId);
  if (!job) {
    throw new NotFoundError('Job not found');
  }

  // Look up role from DB — never trust caller-supplied role
  const { User } = await import('../models');
  const viewer = await User.findById(viewerId);
  const viewerRole = (viewer?.role || 'alumni') as Role;

  // Verify viewer is a participant or admin
  const isParticipant =
    job.clientId.toString() === viewerId ||
    (job.photographerId && job.photographerId.toString() === viewerId);

  if (!isParticipant && viewerRole !== Role.ADMIN) {
    throw new ForbiddenError('Only job participants can view messages');
  }

  const skip = (page - 1) * limit;

  // Fetch all messages for the job
  const messages = await JobMessage.find({ jobId })
    .sort({ createdAt: 1 })
    .skip(skip)
    .limit(limit)
    .lean();

  // Filter: pending messages are only visible to their sender (or admin)
  const filtered = messages.filter(msg => {
    if (msg.reviewStatus === ContentReviewStatus.PENDING) {
      return msg.senderId.toString() === viewerId || viewerRole === Role.ADMIN;
    }
    return msg.reviewStatus === ContentReviewStatus.APPROVED || viewerRole === Role.ADMIN;
  });

  const total = await JobMessage.countDocuments({ jobId });

  return { messages: filtered, total, page, limit };
}
