import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FileAttachment } from '../models';
import { config } from '../config';
import { ValidationError, NotFoundError } from '../utils/errors';
import { validateFileType, validateFileSize, validateFileFormat, sanitizeFilename } from '../utils/documentValidators';
import { computeSHA256 } from '../utils/fileChecksum';

export interface SaveFileInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  parentType: string;
  parentId: string;
  uploadedBy: string;
}

/**
 * Save a file to the upload directory with a UUID-based filename.
 */
export async function saveFile(input: SaveFileInput): Promise<{
  storagePath: string;
  checksum: string;
  sizeBytes: number;
}> {
  const ext = path.extname(input.originalName) || '';
  const filename = `${uuidv4()}${ext}`;
  const uploadDir = path.resolve(config.uploadDir);

  // Ensure upload directory exists
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storagePath = path.join(uploadDir, filename);

  // Prevent path traversal: verify resolved path stays inside upload directory
  const resolvedStorage = path.resolve(storagePath);
  if (!resolvedStorage.startsWith(uploadDir + path.sep) && resolvedStorage !== uploadDir) {
    throw new ValidationError('Invalid storage path');
  }

  const checksum = computeSHA256(input.buffer);

  fs.writeFileSync(resolvedStorage, input.buffer);

  return {
    storagePath: resolvedStorage,
    checksum,
    sizeBytes: input.buffer.length,
  };
}

/**
 * Validate file and store it with a FileAttachment record.
 *
 * Checksum policy: The SHA-256 checksum is computed server-side from the
 * uploaded buffer. Clients do NOT supply checksums — the server is the sole
 * authority. Stored checksums can be used for integrity verification on
 * subsequent reads or exports.
 */
export async function validateAndStore(input: SaveFileInput) {
  // Validate file
  validateFileType(input.mimeType);
  validateFileSize(input.buffer.length);
  validateFileFormat(input.buffer, input.mimeType);

  const sanitized = sanitizeFilename(input.originalName);

  // Save to disk
  const { storagePath, checksum, sizeBytes } = await saveFile({
    ...input,
    originalName: sanitized,
  });

  // Create FileAttachment record
  const attachment = await FileAttachment.create({
    parentType: input.parentType,
    parentId: input.parentId,
    originalName: sanitized,
    storagePath,
    mimeType: input.mimeType,
    sizeBytes,
    checksum,
    uploadedBy: input.uploadedBy,
  });

  return attachment;
}

/**
 * Retrieve a file by its FileAttachment ID.
 * Enforces strict access control: only the uploader, job participants, or admins
 * may access the file. Denied attempts are audit-logged.
 */
export async function getFile(fileId: string, requesterId: string) {
  const { checkDocumentAccess } = await import('./documentAccess.service');
  const { User } = await import('../models');

  // Look up the requester's role from the DB — never trust caller-supplied role
  const requester = await User.findById(requesterId);
  const requesterRole = requester?.role || 'alumni';

  // checkDocumentAccess throws ForbiddenError if denied and audit-logs the denial
  const { file: attachment } = await checkDocumentAccess(
    fileId,
    requesterId,
    requesterRole as any,
  );

  const filePath = attachment.storagePath;
  // Prevent path traversal: resolve and verify the path is inside the upload directory
  const resolvedPath = path.resolve(filePath);
  const uploadRoot = path.resolve(config.uploadDir);
  if (!resolvedPath.startsWith(uploadRoot)) {
    throw new ValidationError('Invalid file path');
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new NotFoundError('File not found on disk');
  }

  const buffer = fs.readFileSync(resolvedPath);

  return {
    buffer,
    mimeType: attachment.mimeType,
    filename: attachment.originalName,
  };
}
