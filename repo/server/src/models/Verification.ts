import mongoose, { Schema, Document } from 'mongoose';
import { VerificationStatus } from '../types/enums';

export interface IVerification extends Document {
  photographerId: mongoose.Types.ObjectId;
  realName: string; // encrypted
  qualificationType: string;
  issuingAuthority?: string;
  idDocumentPath: string; // encrypted path
  qualificationDocPaths: string[]; // encrypted
  status: VerificationStatus;
  reviewReason?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  submittedAt: Date;
  fileChecksums: string[];
}

const VerificationSchema = new Schema<IVerification>({
  photographerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  realName: { type: String, required: true },
  qualificationType: { type: String, required: true },
  issuingAuthority: String,
  idDocumentPath: { type: String, required: true },
  qualificationDocPaths: [String],
  status: { type: String, enum: Object.values(VerificationStatus), default: VerificationStatus.SUBMITTED },
  reviewReason: String,
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  submittedAt: { type: Date, default: Date.now },
  fileChecksums: [String],
}, { timestamps: true });

VerificationSchema.index({ photographerId: 1 });
VerificationSchema.index({ status: 1 });

export const Verification = mongoose.model<IVerification>('Verification', VerificationSchema);
