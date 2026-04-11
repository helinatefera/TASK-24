import mongoose, { Schema, Document } from 'mongoose';
import { SettlementStatus } from '../types/enums';

export interface ISettlement extends Document {
  jobId: mongoose.Types.ObjectId;
  photographerId: mongoose.Types.ObjectId;
  clientId: mongoose.Types.ObjectId;
  status: SettlementStatus;
  subtotalCents: number;
  adjustmentCents: number;
  finalAmountCents: number;
  variancePercent?: number;
  varianceAmountCents?: number;
  varianceReason?: string;
  photographerApproved: boolean;
  clientApproved: boolean;
  exportedAt?: Date;
}

const SettlementSchema = new Schema<ISettlement>({
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
  photographerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  clientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: Object.values(SettlementStatus), default: SettlementStatus.DRAFT },
  subtotalCents: { type: Number, default: 0 },
  adjustmentCents: { type: Number, default: 0 },
  finalAmountCents: { type: Number, default: 0 },
  variancePercent: Number,
  varianceAmountCents: Number,
  varianceReason: String,
  photographerApproved: { type: Boolean, default: false },
  clientApproved: { type: Boolean, default: false },
  exportedAt: Date,
}, { timestamps: true });

SettlementSchema.index({ jobId: 1 });
SettlementSchema.index({ photographerId: 1 });
SettlementSchema.index({ clientId: 1 });

export const Settlement = mongoose.model<ISettlement>('Settlement', SettlementSchema);
