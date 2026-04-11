import crypto from 'crypto';
import mongoose, { Schema, Document } from 'mongoose';

export interface IDeviceFingerprint extends Document {
  userId: mongoose.Types.ObjectId;
  fingerprintHash: string;
  consentGiven: boolean;
  userAgent?: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  isBlacklisted: boolean;
}

export function hashFingerprint(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

const DeviceFingerprintSchema = new Schema<IDeviceFingerprint>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  fingerprintHash: { type: String, required: true },
  consentGiven: { type: Boolean, required: true },
  userAgent: String,
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  isBlacklisted: { type: Boolean, default: false },
}, { timestamps: true });

DeviceFingerprintSchema.index({ userId: 1 });
DeviceFingerprintSchema.index({ fingerprintHash: 1 });
DeviceFingerprintSchema.index({ userId: 1, fingerprintHash: 1 }, { unique: true });

export const DeviceFingerprint = mongoose.model<IDeviceFingerprint>('DeviceFingerprint', DeviceFingerprintSchema);
