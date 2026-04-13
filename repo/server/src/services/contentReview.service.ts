import { ContentReview } from '../models';
import { ContentReviewStatus, ReviewableContentType } from '../types/enums';
import { NotFoundError, ValidationError } from '../utils/errors';

export async function submitForReview(contentType: ReviewableContentType, contentId: string, submittedBy: string, flaggedWords: string[]) {
  return ContentReview.create({ contentType, contentId, submittedBy, flaggedWords, status: ContentReviewStatus.PENDING });
}

export async function getPending(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    ContentReview.find({ status: ContentReviewStatus.PENDING }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ContentReview.countDocuments({ status: ContentReviewStatus.PENDING }),
  ]);
  return { items, total, page, limit };
}

export async function reviewContent(id: string, reviewedBy: string, status: ContentReviewStatus, reviewNotes?: string) {
  const review = await ContentReview.findById(id);
  if (!review) throw new NotFoundError('Content review not found');

  if (review.status !== ContentReviewStatus.PENDING) {
    throw new ValidationError(
      `Cannot review content with status "${review.status}". Only pending content can be reviewed.`
    );
  }

  review.status = status;
  review.reviewedBy = reviewedBy as any;
  review.reviewNotes = reviewNotes;
  review.reviewedAt = new Date();
  await review.save();

  // Propagate decision to the source content
  await propagateDecision(review.contentType as ReviewableContentType, review.contentId.toString(), status);

  return review;
}

async function propagateDecision(contentType: ReviewableContentType, contentId: string, status: ContentReviewStatus) {
  if (contentType === ReviewableContentType.JOB_MESSAGE) {
    const { JobMessage } = await import('../models');
    await JobMessage.findByIdAndUpdate(contentId, { reviewStatus: status });
  } else if (contentType === ReviewableContentType.PORTFOLIO) {
    const { Portfolio } = await import('../models');
    await Portfolio.findByIdAndUpdate(contentId, { reviewStatus: status });
  }
}
