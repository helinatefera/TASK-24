import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { Role, AccountStatus } from '../types/enums';
import { config } from '../config';

export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash: string;
  role: Role;
  accountStatus: AccountStatus;
  isBlacklisted: boolean;
  isAlumni: boolean;
  communityId: string;
  failedLoginAttempts: number;
  lastLoginAt?: Date;
  lastActivityAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 50 },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: Object.values(Role), default: Role.ALUMNI },
  accountStatus: { type: String, enum: Object.values(AccountStatus), default: AccountStatus.ACTIVE },
  isBlacklisted: { type: Boolean, default: false },
  isAlumni: { type: Boolean, default: true },
  communityId: { type: String, default: 'default' },
  failedLoginAttempts: { type: Number, default: 0 },
  lastLoginAt: Date,
  lastActivityAt: Date,
}, { timestamps: true });

UserSchema.index({ username: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1, accountStatus: 1 });
UserSchema.index({ communityId: 1 });

UserSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  try {
    this.passwordHash = await bcrypt.hash(this.passwordHash, config.bcryptRounds);
    next();
  } catch (err: any) {
    next(err);
  }
});

UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

UserSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    delete ret.passwordHash;
    return ret;
  },
});

export const User = mongoose.model<IUser>('User', UserSchema);
