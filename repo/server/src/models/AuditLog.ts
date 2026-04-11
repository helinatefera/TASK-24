import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  timestamp: Date;
  actorId?: mongoose.Types.ObjectId;
  actorRole?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  deviceFingerprint?: string;
  outcome: 'success' | 'failure';
  requestId?: string;
}

const AuditLogSchema = new Schema<IAuditLog>({
  timestamp: { type: Date, required: true, default: Date.now },
  actorId: { type: Schema.Types.ObjectId, ref: 'User' },
  actorRole: String,
  action: { type: String, required: true },
  resource: { type: String, required: true },
  resourceId: String,
  details: Schema.Types.Mixed,
  ipAddress: String,
  deviceFingerprint: String,
  outcome: { type: String, enum: ['success', 'failure'], required: true },
  requestId: String,
}, { timestamps: false });

AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ actorId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ resource: 1, resourceId: 1 });

// 7-year retention: TTL index auto-deletes after 7 years (2556 days)
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2556 * 24 * 60 * 60 });

// Immutability: block update and delete at the Mongoose level.
// The only allowed write operation is insertOne/create.
function blockMutation(this: any, next: Function) {
  next(new Error('Audit log entries are immutable — updates and deletes are not allowed'));
}

AuditLogSchema.pre('updateOne', blockMutation);
AuditLogSchema.pre('updateMany', blockMutation);
AuditLogSchema.pre('findOneAndUpdate', blockMutation);
AuditLogSchema.pre('findOneAndDelete', blockMutation);
AuditLogSchema.pre('deleteOne', blockMutation);
AuditLogSchema.pre('deleteMany', blockMutation);

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
