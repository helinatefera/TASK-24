import mongoose, { Schema, Document } from 'mongoose';
import { PaymentMethod } from '../types/enums';

export interface IPayment extends Document {
  settlementId: mongoose.Types.ObjectId;
  amountCents: number;
  method: PaymentMethod;
  receiptDetails: {
    referenceNumber?: string;
    date?: Date;
    notes?: string;
    attachmentId?: string;
  };
  paidAt: Date;
  recordedBy: mongoose.Types.ObjectId;
}

const PaymentSchema = new Schema<IPayment>({
  settlementId: { type: Schema.Types.ObjectId, ref: 'Settlement', required: true },
  amountCents: { type: Number, required: true },
  method: { type: String, enum: Object.values(PaymentMethod), required: true },
  receiptDetails: {
    referenceNumber: String,
    date: Date,
    notes: String,
    attachmentId: String,
  },
  paidAt: { type: Date, required: true },
  recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

PaymentSchema.index({ settlementId: 1 });

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
