import mongoose, { Schema, Document } from 'mongoose';

export interface IFileAttachment extends Document {
  parentType: string;
  parentId: mongoose.Types.ObjectId;
  originalName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  uploadedBy: mongoose.Types.ObjectId;
}

const FileAttachmentSchema = new Schema<IFileAttachment>({
  parentType: { type: String, required: true, enum: ['settlement', 'report', 'verification', 'portfolio', 'deliverable'] },
  parentId: { type: Schema.Types.ObjectId, required: true },
  originalName: { type: String, required: true },
  storagePath: { type: String, required: true },
  mimeType: { type: String, required: true },
  sizeBytes: { type: Number, required: true },
  checksum: { type: String, required: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

FileAttachmentSchema.index({ parentType: 1, parentId: 1 });

export const FileAttachment = mongoose.model<IFileAttachment>('FileAttachment', FileAttachmentSchema);
