export const LOCK_HOURS = parseInt(process.env.LOCK_HOURS || '48', 10);
export const ACCESS_REQUEST_EXPIRY_DAYS = 7;
export const CONSENT_RECHECK_DAYS = 30;
export const FILE_MAX_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
export const TIMESHEET_INCREMENT_MINUTES = 15;
export const VARIANCE_PERCENT = 0.02;
export const VARIANCE_ABSOLUTE_CENTS = 2500;

export const AUDIT_EVENTS = {
  LOGIN_ATTEMPT: 'login_attempt',
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILURE: 'login_failure',
  PERMISSION_CHANGE: 'permission_change',
  ROLE_CHANGE: 'role_change',
  KYC_SUBMIT: 'kyc_submit',
  KYC_REVIEW: 'kyc_review',
  KYC_APPROVE: 'kyc_approve',
  KYC_REJECT: 'kyc_reject',
  DATA_EXPORT: 'data_export',
  EXPORT_BLOCKED: 'export_blocked',
  RECORD_DELETE: 'record_delete',
  BLACKLIST_ADD: 'blacklist_add',
  BLACKLIST_REMOVE: 'blacklist_remove',
  ACCESS_DENIED: 'access_denied',
  ACCESS_REQUEST_CREATED: 'access_request_created',
  ACCESS_REQUEST_APPROVED: 'access_request_approved',
  ACCESS_REQUEST_DENIED: 'access_request_denied',
  ACCESS_REQUEST_EXPIRED: 'access_request_expired',
  CONSENT_GRANTED: 'consent_granted',
  CONSENT_REVOKED: 'consent_revoked',
  CONTENT_FLAGGED: 'content_flagged',
  REPORT_CREATED: 'report_created',
} as const;

export const DATA_CATEGORIES = [
  'account_identity',
  'contact_information',
  'employer_information',
  'government_id',
  'tax_forms',
  'qualification_documents',
  'device_fingerprint',
] as const;
