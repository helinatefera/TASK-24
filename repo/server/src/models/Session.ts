import mongoose, { Schema, Document } from 'mongoose';

export interface ISession extends Document {
  userId: mongoose.Types.ObjectId;
  jti: string;
  deviceFingerprint?: string;
  issuedAt: Date;
  lastActivityAt: Date;
  absoluteExpiry: Date;
  isRevoked: boolean;
  revokedAt?: Date;
}

const SessionSchema = new Schema<ISession>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  jti: { type: String, required: true, unique: true },
  deviceFingerprint: String,
  issuedAt: { type: Date, required: true },
  lastActivityAt: { type: Date, required: true },
  absoluteExpiry: { type: Date, required: true },
  isRevoked: { type: Boolean, default: false },
  revokedAt: Date,
}, { timestamps: true });

SessionSchema.index({ jti: 1 });
SessionSchema.index({ userId: 1 });
SessionSchema.index({ absoluteExpiry: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.model<ISession>('Session', SessionSchema);
