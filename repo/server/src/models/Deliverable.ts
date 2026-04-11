import mongoose, { Schema, Document } from 'mongoose';

export interface IDeliverable extends Document {
  jobId: mongoose.Types.ObjectId;
  photographerId: mongoose.Types.ObjectId;
  filePath: string;
  copyrightNotice: string;
  uploadedBy: mongoose.Types.ObjectId;
  visibleTo: mongoose.Types.ObjectId[];
}

const DeliverableSchema = new Schema<IDeliverable>({
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
  photographerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  filePath: { type: String, required: true },
  copyrightNotice: { type: String, required: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  visibleTo: [{ type: Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

DeliverableSchema.index({ jobId: 1 });

export const Deliverable = mongoose.model<IDeliverable>('Deliverable', DeliverableSchema);
