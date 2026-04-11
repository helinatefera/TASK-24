import { Report } from '../models';
import { ReportStatus } from '../types/enums';
import { RateLimitError, NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { AuditLog } from '../models/AuditLog';
import { AUDIT_EVENTS } from '../utils/constants';
import { config } from '../config';

export async function createReport(reporterId: string, data: any) {
  // Enforce first-use consent for account_identity before submitting reports
  const { checkConsent } = await import('./dataCategoryConsent.service');
  const { hasConsent } = await checkConsent(reporterId, 'account_identity');
  if (!hasConsent) {
    throw new ForbiddenError('Consent for account_identity data category is required before submitting reports');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const count = await Report.countDocuments({
    reporterId,
    createdAt: { $gte: today },
  });
  if (count >= config.reportsPerDay) {
    throw new RateLimitError(`Maximum ${config.reportsPerDay} reports per day`);
  }
  const report = await Report.create({
    ...data,
    reporterId,
    status: ReportStatus.SUBMITTED,
    statusHistory: [{ status: ReportStatus.SUBMITTED, changedBy: reporterId, changedAt: new Date() }],
  });
  await AuditLog.create({
    timestamp: new Date(), actorId: reporterId, action: AUDIT_EVENTS.REPORT_CREATED,
    resource: 'report', resourceId: report._id!.toString(), outcome: 'success',
  });
  return report;
}

export async function getMyReports(reporterId: string) {
  return Report.find({ reporterId }).sort({ createdAt: -1 });
}

export async function getAllReports(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Report.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
    Report.countDocuments(),
  ]);
  return { items, total, page, limit };
}

export async function reviewReport(id: string, adminId: string, status: ReportStatus, notes?: string, resolution?: string) {
  const report = await Report.findById(id);
  if (!report) throw new NotFoundError('Report not found');

  const validTransitions: Record<string, string[]> = {
    [ReportStatus.SUBMITTED]: [ReportStatus.UNDER_REVIEW],
    [ReportStatus.UNDER_REVIEW]: [ReportStatus.NEEDS_MORE_INFO, ReportStatus.ACTION_TAKEN, ReportStatus.REJECTED],
    [ReportStatus.NEEDS_MORE_INFO]: [ReportStatus.UNDER_REVIEW, ReportStatus.CLOSED],
    [ReportStatus.ACTION_TAKEN]: [ReportStatus.CLOSED],
    [ReportStatus.REJECTED]: [ReportStatus.CLOSED],
  };
  if (!validTransitions[report.status]?.includes(status)) {
    throw new ValidationError(`Cannot transition from ${report.status} to ${status}`);
  }

  report.status = status;
  report.statusHistory.push({ status, changedBy: adminId as any, changedAt: new Date(), notes });
  if (resolution) report.resolution = resolution;
  report.reviewedBy = adminId as any;
  report.reviewedAt = new Date();
  return report.save();
}
