export interface User {
  _id: string;
  username: string;
  email: string;
  role: 'alumni' | 'photographer' | 'admin';
  accountStatus: string;
  isAlumni: boolean;
  communityId: string;
}

export interface Profile {
  _id: string;
  userId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  bio: string;
  location: string;
  employer: string;
  graduationYear?: number;
  privacySettings: Record<string, string>;
}

export interface Job {
  _id: string;
  title: string;
  description: string;
  clientId: string;
  photographerId?: string;
  communityId: string;
  jobType: 'event' | 'portrait';
  status: string;
  rateType: 'hourly' | 'piece_rate';
  agreedRateCents: number;
  estimatedTotalCents: number;
  createdAt: string;
}

export interface WorkEntry {
  _id: string;
  jobId: string;
  entryType: 'time' | 'piece_rate';
  date?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  itemDescription?: string;
  quantity?: number;
  unitRateCents?: number;
  subtotalCents: number;
  isLocked: boolean;
  clientConfirmedAt?: string;
  photographerConfirmedAt?: string;
}

export interface Settlement {
  _id: string;
  jobId: string;
  status: string;
  subtotalCents: number;
  adjustmentCents: number;
  finalAmountCents: number;
  varianceReason?: string;
  photographerApproved: boolean;
  clientApproved: boolean;
}

export interface Portfolio {
  _id: string;
  photographerId: string;
  title: string;
  description: string;
  specialties: string[];
  reviewStatus: string;
}

export interface Report {
  _id: string;
  category: string;
  description: string;
  status: string;
  statusHistory: { status: string; changedAt: string; notes?: string }[];
  createdAt: string;
}

export interface AccessRequestType {
  _id: string;
  requesterId: string;
  targetUserId: string;
  fields: string[];
  reason: string;
  status: string;
  expiresAt: string;
}

export interface AuditLogEntry {
  _id: string;
  timestamp: string;
  actorId?: string;
  action: string;
  resource: string;
  outcome: string;
  details?: Record<string, any>;
}

export interface ApiError {
  code: number;
  msg: string;
}
