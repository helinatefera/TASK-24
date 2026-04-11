import mongoose, { Schema, Document } from 'mongoose';

export interface IServiceAgreement extends Document {
  jobId: mongoose.Types.ObjectId;
  version: number;
  content: string;
  clientConfirmedAt?: Date;
  photographerConfirmedAt?: Date;
}

const ServiceAgreementSchema = new Schema<IServiceAgreement>({
  jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
  version: { type: Number, default: 1 },
  content: { type: String, required: true },
  clientConfirmedAt: Date,
  photographerConfirmedAt: Date,
}, { timestamps: true });

ServiceAgreementSchema.index({ jobId: 1 });

export const ServiceAgreement = mongoose.model<IServiceAgreement>('ServiceAgreement', ServiceAgreementSchema);
