import mongoose, { Schema, Document } from 'mongoose';

export interface IConsent extends Document {
  userId: mongoose.Types.ObjectId;
  policyVersion: string;
  purposes: { purpose: string; consented: boolean; consentedAt: Date }[];
  consentedAt: Date;
  reconsentDeadline?: Date;
  needsReconsent: boolean;
  policyChangeDetectedAt?: Date;
  isActive: boolean;
}

const ConsentSchema = new Schema<IConsent>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  policyVersion: { type: String, required: true },
  purposes: [{
    purpose: String,
    consented: Boolean,
    consentedAt: Date,
  }],
  consentedAt: { type: Date, required: true },
  reconsentDeadline: Date,
  needsReconsent: { type: Boolean, default: false },
  policyChangeDetectedAt: Date,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

ConsentSchema.index({ userId: 1, policyVersion: 1 });

export const Consent = mongoose.model<IConsent>('Consent', ConsentSchema);
