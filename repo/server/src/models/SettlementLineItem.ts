import mongoose, { Schema, Document } from 'mongoose';
import { LineItemType, AdjustmentType } from '../types/enums';

export interface ISettlementLineItem extends Document {
  settlementId: mongoose.Types.ObjectId;
  description: string;
  amountCents: number;
  type: LineItemType;
  adjustmentType?: AdjustmentType;
  adjustmentReason?: string;
  workEntryId?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
}

const SettlementLineItemSchema = new Schema<ISettlementLineItem>({
  settlementId: { type: Schema.Types.ObjectId, ref: 'Settlement', required: true },
  description: { type: String, required: true },
  amountCents: { type: Number, required: true },
  type: { type: String, enum: Object.values(LineItemType), required: true },
  adjustmentType: { type: String, enum: Object.values(AdjustmentType) },
  adjustmentReason: String,
  workEntryId: { type: Schema.Types.ObjectId, ref: 'WorkEntry' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

SettlementLineItemSchema.index({ settlementId: 1 });

export const SettlementLineItem = mongoose.model<ISettlementLineItem>('SettlementLineItem', SettlementLineItemSchema);
