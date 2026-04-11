import mongoose, { Schema, Document } from 'mongoose';
import { ReportCategory, ReportStatus } from '../types/enums';

export interface IStatusHistoryEntry {
  status: ReportStatus;
  changedBy: mongoose.Types.ObjectId;
  changedAt: Date;
  notes?: string;
}

export interface IReport extends Document {
  reporterId: mongoose.Types.ObjectId;
  targetType: string;
  targetId: mongoose.Types.ObjectId;
  category: ReportCategory;
  description: string;
  evidenceAttachmentIds: mongoose.Types.ObjectId[];
  status: ReportStatus;
  statusHistory: IStatusHistoryEntry[];
  adminNotes?: string;
  resolution?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
}

const ReportSchema = new Schema<IReport>({
  reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  targetType: { type: String, required: true, enum: ['user', 'portfolio', 'portfolio_image', 'job', 'message'] },
  targetId: { type: Schema.Types.ObjectId, required: true },
  category: { type: String, enum: Object.values(ReportCategory), required: true },
  description: { type: String, required: true },
  evidenceAttachmentIds: [{ type: Schema.Types.ObjectId, ref: 'FileAttachment' }],
  status: { type: String, enum: Object.values(ReportStatus), default: ReportStatus.SUBMITTED },
  statusHistory: [{
    status: { type: String, enum: Object.values(ReportStatus) },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
    notes: String,
  }],
  adminNotes: String,
  resolution: String,
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
}, { timestamps: true });

ReportSchema.index({ reporterId: 1 });
ReportSchema.index({ status: 1 });
ReportSchema.index({ targetType: 1, targetId: 1 });

export const Report = mongoose.model<IReport>('Report', ReportSchema);
