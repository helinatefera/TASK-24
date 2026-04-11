import mongoose, { Schema, Document } from 'mongoose';

export interface ISensitiveWord extends Document {
  word: string;
  severity: 'low' | 'medium' | 'high';
  isActive: boolean;
  addedBy?: mongoose.Types.ObjectId;
}

const SensitiveWordSchema = new Schema<ISensitiveWord>({
  word: { type: String, required: true, unique: true, lowercase: true },
  severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  isActive: { type: Boolean, default: true },
  addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

SensitiveWordSchema.index({ word: 1 });
SensitiveWordSchema.index({ isActive: 1 });

export const SensitiveWord = mongoose.model<ISensitiveWord>('SensitiveWord', SensitiveWordSchema);
