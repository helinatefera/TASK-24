import mongoose, { Schema, Document } from 'mongoose';
import { EscrowEntryType } from '../types/enums';

export interface IEscrowLedger extends Document {
  jobId: mongoose.Types.ObjectId;
  entryType: EscrowEntryType;
  amountCents: number;
  balanceCents: number;
  description: string;
  recordedBy: mongoose.Types.ObjectId;
}

const EscrowLedgerSchema = new Schema<IEscrowLedger>({
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
  entryType: { type: String, enum: Object.values(EscrowEntryType), required: true },
  amountCents: { type: Number, required: true },
  balanceCents: { type: Number, required: true },
  description: { type: String, required: true },
  recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

EscrowLedgerSchema.index({ jobId: 1, createdAt: 1 });

export const EscrowLedger = mongoose.model<IEscrowLedger>('EscrowLedger', EscrowLedgerSchema);
