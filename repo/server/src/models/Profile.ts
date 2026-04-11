import mongoose, { Schema, Document } from 'mongoose';
import { PrivacyLevel } from '../types/enums';

const privacyEnum = Object.values(PrivacyLevel);

export interface IProfile extends Document {
  userId: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  bio: string;
  location: string;
  employer: string;
  graduationYear?: number;
  avatarPath?: string;
  privacySettings: {
    firstName: PrivacyLevel;
    lastName: PrivacyLevel;
    phone: PrivacyLevel;
    email: PrivacyLevel;
    bio: PrivacyLevel;
    location: PrivacyLevel;
    employer: PrivacyLevel;
    graduationYear: PrivacyLevel;
  };
}

const PrivacySettingsSchema = new Schema({
  firstName: { type: String, enum: privacyEnum, default: PrivacyLevel.PUBLIC },
  lastName: { type: String, enum: privacyEnum, default: PrivacyLevel.PUBLIC },
  phone: { type: String, enum: privacyEnum, default: PrivacyLevel.PRIVATE },
  email: { type: String, enum: privacyEnum, default: PrivacyLevel.ALUMNI_ONLY },
  bio: { type: String, enum: privacyEnum, default: PrivacyLevel.PUBLIC },
  location: { type: String, enum: privacyEnum, default: PrivacyLevel.PUBLIC },
  employer: { type: String, enum: privacyEnum, default: PrivacyLevel.PRIVATE },
  graduationYear: { type: String, enum: privacyEnum, default: PrivacyLevel.ALUMNI_ONLY },
}, { _id: false });

const ProfileSchema = new Schema<IProfile>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  bio: { type: String, default: '' },
  location: { type: String, default: '' },
  employer: { type: String, default: '' },
  graduationYear: Number,
  avatarPath: String,
  privacySettings: { type: PrivacySettingsSchema, default: () => ({}) },
}, { timestamps: true });

ProfileSchema.index({ userId: 1 });

export const Profile = mongoose.model<IProfile>('Profile', ProfileSchema);
