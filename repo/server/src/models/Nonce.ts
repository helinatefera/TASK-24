import mongoose, { Schema, Document } from 'mongoose';

export interface INonce extends Document {
  nonce: string;
  timestamp: Date;
  createdAt: Date;
}

const NonceSchema = new Schema<INonce>({
  nonce: { type: String, required: true, unique: true },
  timestamp: { type: Date, required: true },
}, { timestamps: true });

NonceSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 });

export const Nonce = mongoose.model<INonce>('Nonce', NonceSchema);
