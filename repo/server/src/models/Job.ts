import mongoose, { Schema, Document } from 'mongoose';
import { JobType, JobStatus, RateType } from '../types/enums';

export interface IJob extends Document {
  title: string;
  description: string;
  clientId: mongoose.Types.ObjectId;
  photographerId?: mongoose.Types.ObjectId;
  communityId: string;
  jobType: JobType;
  status: JobStatus;
  rateType: RateType;
  agreedRateCents: number;
  estimatedTotalCents: number;
  serviceAgreementId?: mongoose.Types.ObjectId;
  clientConfirmed: boolean;
  photographerConfirmed: boolean;
  completedAt?: Date;
}

const JobSchema = new Schema<IJob>({
  title: { type: String, required: true },
  description: { type: String, required: true },
  clientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  photographerId: { type: Schema.Types.ObjectId, ref: 'User' },
  communityId: { type: String, required: true },
  jobType: { type: String, enum: Object.values(JobType), required: true },
  status: { type: String, enum: Object.values(JobStatus), default: JobStatus.DRAFT },
  rateType: { type: String, enum: Object.values(RateType), required: true },
  agreedRateCents: { type: Number, required: true },
  estimatedTotalCents: { type: Number, default: 0 },
  serviceAgreementId: { type: Schema.Types.ObjectId, ref: 'ServiceAgreement' },
  clientConfirmed: { type: Boolean, default: false },
  photographerConfirmed: { type: Boolean, default: false },
  completedAt: Date,
}, { timestamps: true });

JobSchema.index({ clientId: 1, status: 1 });
JobSchema.index({ photographerId: 1, status: 1 });
JobSchema.index({ communityId: 1, status: 1 });

export const Job = mongoose.model<IJob>('Job', JobSchema);
