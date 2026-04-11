import mongoose, { Schema, Document } from 'mongoose';

export interface IDataCategoryConsent extends Document {
  userId: mongoose.Types.ObjectId;
  dataCategory: string;
  disclosureText: string;
  purposeDescription: string;
  consentedAt: Date;
  revokedAt?: Date;
}

const DataCategoryConsentSchema = new Schema<IDataCategoryConsent>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  dataCategory: { type: String, required: true },
  disclosureText: { type: String, required: true },
  purposeDescription: { type: String, required: true },
  consentedAt: { type: Date, required: true },
  revokedAt: Date,
}, { timestamps: true });

DataCategoryConsentSchema.index({ userId: 1, dataCategory: 1 });

export const DataCategoryConsent = mongoose.model<IDataCategoryConsent>('DataCategoryConsent', DataCategoryConsentSchema);
