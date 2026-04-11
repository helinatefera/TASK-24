export enum Role {
  ALUMNI = 'alumni',
  PHOTOGRAPHER = 'photographer',
  ADMIN = 'admin',
}

export enum AccountStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  BANNED = 'banned',
  DELETED = 'deleted',
}

export enum PrivacyLevel {
  PUBLIC = 'public',
  ALUMNI_ONLY = 'alumni_only',
  PRIVATE = 'private',
}

export enum JobType {
  EVENT = 'event',
  PORTRAIT = 'portrait',
}

export enum JobStatus {
  DRAFT = 'draft',
  POSTED = 'posted',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  DISPUTED = 'disputed',
}

export enum RateType {
  HOURLY = 'hourly',
  PIECE_RATE = 'piece_rate',
}

export enum WorkEntryType {
  TIME = 'time',
  PIECE_RATE = 'piece_rate',
}

export enum VerificationStatus {
  SUBMITTED = 'submitted',
  NEEDS_CHANGES = 'needs_changes',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export enum AccessRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  DENIED = 'denied',
  EXPIRED = 'expired',
}

export enum SettlementStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  PAID = 'paid',
  DISPUTED = 'disputed',
}

export enum AdjustmentType {
  DISCOUNT = 'discount',
  SURCHARGE = 'surcharge',
  CORRECTION = 'correction',
  REFUND_ADJUSTMENT = 'refund_adjustment',
}

export enum LineItemType {
  TIMESHEET = 'timesheet',
  PIECE_RATE = 'piece_rate',
  ADJUSTMENT = 'adjustment',
  TAX = 'tax',
  DISCOUNT = 'discount',
}

export enum PaymentMethod {
  CASH = 'cash',
  CHECK = 'check',
  BANK_TRANSFER = 'bank_transfer',
  OTHER = 'other',
}

export enum EscrowEntryType {
  DEPOSIT = 'deposit',
  RELEASE = 'release',
  REFUND = 'refund',
  ADJUSTMENT = 'adjustment',
}

export enum ReportCategory {
  INAPPROPRIATE_CONTENT = 'inappropriate_content',
  HARASSMENT = 'harassment',
  FRAUD = 'fraud',
  COPYRIGHT_VIOLATION = 'copyright_violation',
  SPAM = 'spam',
  OTHER = 'other',
}

export enum ReportStatus {
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  NEEDS_MORE_INFO = 'needs_more_info',
  ACTION_TAKEN = 'action_taken',
  REJECTED = 'rejected',
  CLOSED = 'closed',
}

export enum ContentReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum ReviewableContentType {
  PORTFOLIO = 'portfolio',
  JOB_MESSAGE = 'job_message',
  JOB_DESCRIPTION = 'job_description',
  REPORT_DESCRIPTION = 'report_description',
}

export enum BlacklistTargetType {
  ACCOUNT = 'account',
  DEVICE = 'device',
}
