import { Job, Verification, ServiceAgreement, User, IJob } from '../models';
import { JobStatus, VerificationStatus, Role } from '../types/enums';
import { NotFoundError, ValidationError, ForbiddenError, AuthError } from '../utils/errors';

// Valid state transitions for the job status state machine
const JOB_STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  [JobStatus.DRAFT]: [JobStatus.POSTED, JobStatus.CANCELLED],
  [JobStatus.POSTED]: [JobStatus.ASSIGNED, JobStatus.CANCELLED],
  [JobStatus.ASSIGNED]: [JobStatus.IN_PROGRESS, JobStatus.CANCELLED],
  [JobStatus.IN_PROGRESS]: [JobStatus.REVIEW, JobStatus.DISPUTED, JobStatus.CANCELLED],
  [JobStatus.REVIEW]: [JobStatus.COMPLETED, JobStatus.IN_PROGRESS, JobStatus.DISPUTED],
  [JobStatus.COMPLETED]: [],
  [JobStatus.CANCELLED]: [],
  [JobStatus.DISPUTED]: [JobStatus.IN_PROGRESS, JobStatus.CANCELLED, JobStatus.COMPLETED],
};

export interface CreateJobInput {
  title: string;
  description: string;
  clientId: string;
  communityId: string;
  jobType: string;
  rateType: string;
  agreedRateCents: number;
  estimatedTotalCents?: number;
}

export async function createJob(input: CreateJobInput) {
  const job = await Job.create({
    title: input.title,
    description: input.description,
    clientId: input.clientId,
    communityId: input.communityId,
    jobType: input.jobType,
    status: JobStatus.DRAFT,
    rateType: input.rateType,
    agreedRateCents: input.agreedRateCents,
    estimatedTotalCents: input.estimatedTotalCents || 0,
  });
  return job;
}

export async function getJobById(jobId: string, requesterId: string) {
  const job = await Job.findById(jobId);
  if (!job) {
    throw new NotFoundError('Job not found');
  }
  // Look up the requester's role from DB — never trust caller-supplied role
  const requester = await User.findById(requesterId);
  const requesterRole = requester?.role;

  // Object-level authorization: participants, same-community members for posted jobs, or admins
  if (requesterRole !== Role.ADMIN) {
    const isParticipant = job.clientId.toString() === requesterId ||
      (job.photographerId && job.photographerId.toString() === requesterId);
    const isPostedJob = [JobStatus.POSTED].includes(job.status as JobStatus);
    // Posted jobs are only visible to same-community members (alumni isolation).
    // Cross-community access is denied even for posted jobs.
    const isSameCommunity = requester?.communityId && job.communityId &&
      requester.communityId === job.communityId;
    if (!isParticipant && !(isPostedJob && isSameCommunity)) {
      throw new ForbiddenError('You do not have access to this job');
    }
  }
  return job;
}

export async function updateJob(jobId: string, userId: string, data: Partial<IJob>) {
  const job = await Job.findById(jobId);
  if (!job) {
    throw new NotFoundError('Job not found');
  }

  if (job.clientId.toString() !== userId) {
    throw new ForbiddenError('Only the job client can update the job');
  }

  if (job.status !== JobStatus.DRAFT && job.status !== JobStatus.POSTED) {
    throw new ValidationError('Can only update jobs in draft or posted status');
  }

  Object.assign(job, data);
  await job.save();
  return job;
}

/**
 * Assign a photographer to a job.
 * The photographer must have verification status = VERIFIED.
 */
export async function assignPhotographer(
  jobId: string,
  photographerId: string,
  assignedBy: string,
  assignerRole: Role
) {
  const job = await Job.findById(jobId);
  if (!job) {
    throw new NotFoundError('Job not found');
  }

  // Only the job client or an admin can assign
  if (job.clientId.toString() !== assignedBy && assignerRole !== Role.ADMIN) {
    throw new ForbiddenError('Only the job client or an admin can assign a photographer');
  }

  if (job.status !== JobStatus.POSTED) {
    throw new ValidationError('Can only assign a photographer to a posted job');
  }

  // Check photographer is verified
  const verification = await Verification.findOne({
    photographerId,
    status: VerificationStatus.VERIFIED,
  });

  if (!verification) {
    throw new ValidationError(
      'Photographer must have verified status before being assigned to a job'
    );
  }

  job.photographerId = photographerId as any;
  job.status = JobStatus.ASSIGNED;
  await job.save();

  return job;
}

/**
 * Transition job status following the state machine rules.
 */
export async function transitionStatus(
  jobId: string,
  newStatus: JobStatus,
  userId: string,
  userRole: Role
) {
  const job = await Job.findById(jobId);
  if (!job) {
    throw new NotFoundError('Job not found');
  }

  // Check user is a participant or admin
  const isParticipant =
    job.clientId.toString() === userId ||
    (job.photographerId && job.photographerId.toString() === userId);

  if (!isParticipant && userRole !== Role.ADMIN) {
    throw new ForbiddenError('You are not a participant in this job');
  }

  const allowedTransitions = JOB_STATUS_TRANSITIONS[job.status as JobStatus];
  if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
    throw new ValidationError(
      `Cannot transition from ${job.status} to ${newStatus}`
    );
  }

  job.status = newStatus;

  if (newStatus === JobStatus.COMPLETED) {
    job.completedAt = new Date();
  }

  await job.save();
  return job;
}

/**
 * E-confirm service agreement. Both parties must type their password to confirm.
 * The agreement is displayed on-screen and confirmed by re-entering account password.
 * Both client and photographer must confirm before the job can proceed to IN_PROGRESS.
 */
export async function confirmAgreement(
  jobId: string,
  userId: string,
  password: string
): Promise<any> {
  const job = await Job.findById(jobId);
  if (!job) throw new NotFoundError('Job not found');

  if (job.status !== JobStatus.ASSIGNED && job.status !== JobStatus.DRAFT && job.status !== JobStatus.POSTED) {
    throw new ValidationError('Agreement can only be confirmed on an assigned job');
  }

  // Verify user is a participant
  const isClient = job.clientId.toString() === userId;
  const isPhotographer = job.photographerId && job.photographerId.toString() === userId;
  if (!isClient && !isPhotographer) {
    throw new ForbiddenError('Only job participants can confirm the agreement');
  }

  // Re-authenticate: verify password against stored hash
  const user = await User.findById(userId);
  if (!user) throw new AuthError('User not found');
  const passwordValid = await user.comparePassword(password);
  if (!passwordValid) {
    throw new AuthError('Password verification failed. Agreement not confirmed.');
  }

  // Find or create service agreement
  let agreement = await ServiceAgreement.findOne({ jobId });
  if (!agreement) {
    agreement = await ServiceAgreement.create({
      jobId,
      version: 1,
      content: `Service agreement for job "${job.title}". Agreed rate: ${job.agreedRateCents} cents per ${job.rateType === 'hourly' ? 'hour' : 'unit'}. Both parties agree to the terms of service.`,
    });
    job.serviceAgreementId = agreement._id as any;
  }

  // Record confirmation
  if (isClient) {
    if (agreement.clientConfirmedAt) {
      throw new ValidationError('Client has already confirmed this agreement');
    }
    agreement.clientConfirmedAt = new Date();
    job.clientConfirmed = true;
  } else if (isPhotographer) {
    if (agreement.photographerConfirmedAt) {
      throw new ValidationError('Photographer has already confirmed this agreement');
    }
    agreement.photographerConfirmedAt = new Date();
    job.photographerConfirmed = true;
  }

  await agreement.save();

  // If both confirmed, transition to IN_PROGRESS
  if (agreement.clientConfirmedAt && agreement.photographerConfirmedAt) {
    job.status = JobStatus.IN_PROGRESS;
  }

  await job.save();

  return {
    job,
    agreement,
    clientConfirmed: !!agreement.clientConfirmedAt,
    photographerConfirmed: !!agreement.photographerConfirmedAt,
    fullyConfirmed: !!(agreement.clientConfirmedAt && agreement.photographerConfirmedAt),
  };
}

export async function listJobs(filters: {
  clientId?: string;
  photographerId?: string;
  communityId?: string;
  status?: JobStatus;
  page?: number;
  limit?: number;
}) {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const query: any = {};
  if (filters.clientId) query.clientId = filters.clientId;
  if (filters.photographerId) query.photographerId = filters.photographerId;
  if (filters.communityId) query.communityId = filters.communityId;
  if (filters.status) query.status = filters.status;

  const [jobs, total] = await Promise.all([
    Job.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Job.countDocuments(query),
  ]);

  return { jobs, total, page, limit };
}
