import mongoose, { Schema, Document } from 'mongoose';

export interface IPrivacyPolicy extends Document {
  version: string;
  content: string;
  purposes: string[];
  newPurposesIntroduced: string[];
  effectiveDate: Date;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const PrivacyPolicySchema = new Schema<IPrivacyPolicy>({
  version: { type: String, required: true, unique: true },
  content: { type: String, required: true },
  purposes: [{ type: String }],
  newPurposesIntroduced: [{ type: String }],
  effectiveDate: { type: Date, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

PrivacyPolicySchema.index({ version: 1 });
PrivacyPolicySchema.index({ effectiveDate: -1 });

export const PrivacyPolicy = mongoose.model<IPrivacyPolicy>('PrivacyPolicy', PrivacyPolicySchema);
