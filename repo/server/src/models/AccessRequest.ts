import mongoose, { Schema, Document } from 'mongoose';
import { AccessRequestStatus } from '../types/enums';

export interface IAccessRequest extends Document {
  requesterId: mongoose.Types.ObjectId;
  targetUserId: mongoose.Types.ObjectId;
  fields: string[];
  reason: string;
  status: AccessRequestStatus;
  respondedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}

const AccessRequestSchema = new Schema<IAccessRequest>({
  requesterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  targetUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  fields: [{ type: String, required: true }],
  reason: { type: String, required: true },
  status: { type: String, enum: Object.values(AccessRequestStatus), default: AccessRequestStatus.PENDING },
  respondedAt: Date,
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

AccessRequestSchema.index({ targetUserId: 1, status: 1 });
AccessRequestSchema.index({ requesterId: 1 });
AccessRequestSchema.index({ expiresAt: 1 });

export const AccessRequest = mongoose.model<IAccessRequest>('AccessRequest', AccessRequestSchema);
