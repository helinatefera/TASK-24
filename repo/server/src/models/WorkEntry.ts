import mongoose, { Schema, Document } from 'mongoose';
import { WorkEntryType } from '../types/enums';

export interface IWorkEntry extends Document {
  jobId: mongoose.Types.ObjectId;
  photographerId: mongoose.Types.ObjectId;
  entryType: WorkEntryType;
  date?: Date;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  itemDescription?: string;
  quantity?: number;
  unitRateCents?: number;
  subtotalCents: number;
  notes?: string;
  isLocked: boolean;
  lockedAt?: Date;
  clientConfirmedAt?: Date;
  photographerConfirmedAt?: Date;
  lockAt?: Date;
}

const WorkEntrySchema = new Schema<IWorkEntry>({
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
  photographerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  entryType: { type: String, enum: Object.values(WorkEntryType), required: true },
  date: Date,
  startTime: String,
  endTime: String,
  durationMinutes: Number,
  itemDescription: String,
  quantity: Number,
  unitRateCents: Number,
  subtotalCents: { type: Number, required: true },
  notes: String,
  isLocked: { type: Boolean, default: false },
  lockedAt: Date,
  clientConfirmedAt: Date,
  photographerConfirmedAt: Date,
  lockAt: Date,
}, { timestamps: true });

WorkEntrySchema.index({ jobId: 1, date: 1 });
WorkEntrySchema.index({ photographerId: 1 });
WorkEntrySchema.index({ isLocked: 1 });

export const WorkEntry = mongoose.model<IWorkEntry>('WorkEntry', WorkEntrySchema);
