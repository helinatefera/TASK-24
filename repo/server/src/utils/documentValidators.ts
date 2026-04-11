import { ALLOWED_MIME_TYPES, FILE_MAX_SIZE } from './constants';
import { ValidationError } from './errors';

export function validateFileType(mimeType: string): void {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new ValidationError(`File type ${mimeType} not allowed. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`);
  }
}

export function validateFileSize(size: number): void {
  if (size > FILE_MAX_SIZE) {
    throw new ValidationError(`File size ${size} exceeds maximum ${FILE_MAX_SIZE} bytes (10MB)`);
  }
}

export function validateFileFormat(buffer: Buffer, mimeType: string): void {
  if (mimeType === 'application/pdf') {
    if (buffer.length < 5 || buffer.slice(0, 5).toString() !== '%PDF-') {
      throw new ValidationError('Invalid PDF file format');
    }
  } else if (mimeType === 'image/jpeg') {
    if (buffer.length < 2 || buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
      throw new ValidationError('Invalid JPEG file format');
    }
  } else if (mimeType === 'image/png') {
    const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
    if (buffer.length < 4 || !buffer.slice(0, 4).equals(pngSignature)) {
      throw new ValidationError('Invalid PNG file format');
    }
  }
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .slice(0, 255);
}
