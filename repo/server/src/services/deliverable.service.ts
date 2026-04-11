import { Deliverable, Job, User } from '../models';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors';

export async function upload(jobId: string, uploaderId: string, filePath: string, copyrightNotice: string, uploadedBy: string) {
  const job = await Job.findById(jobId);
  if (!job) throw new NotFoundError('Job not found');

  // Only the assigned photographer (or admin) can upload deliverables
  const uploader = await User.findById(uploaderId);
  if (uploader?.role !== 'admin') {
    if (!job.photographerId || job.photographerId.toString() !== uploaderId) {
      throw new ForbiddenError('Only the assigned photographer can upload deliverables');
    }
  }

  if (!copyrightNotice) throw new ValidationError('Copyright notice is required');
  return Deliverable.create({ jobId, photographerId: uploaderId, filePath, copyrightNotice, uploadedBy, visibleTo: [uploadedBy] });
}

export async function getByJob(jobId: string, requesterId: string) {
  const job = await Job.findById(jobId);
  if (!job) throw new NotFoundError('Job not found');

  const requester = await User.findById(requesterId);
  if (requester?.role !== 'admin') {
    const isParticipant =
      job.clientId.toString() === requesterId ||
      (job.photographerId && job.photographerId.toString() === requesterId);
    if (!isParticipant) {
      throw new ForbiddenError('Only job participants can view deliverables');
    }
  }

  return Deliverable.find({ jobId }).sort({ createdAt: -1 });
}
