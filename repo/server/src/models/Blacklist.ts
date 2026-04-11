import mongoose, { Schema, Document } from 'mongoose';
import { BlacklistTargetType } from '../types/enums';

export interface IBlacklist extends Document {
  targetType: BlacklistTargetType;
  targetId: string;
  reason: string;
  blacklistedBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const BlacklistSchema = new Schema<IBlacklist>({
  targetType: { type: String, enum: Object.values(BlacklistTargetType), required: true },
  targetId: { type: String, required: true },
  reason: { type: String, required: true },
  blacklistedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

BlacklistSchema.index({ targetType: 1, targetId: 1 });

export const Blacklist = mongoose.model<IBlacklist>('Blacklist', BlacklistSchema);
