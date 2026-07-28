import { CreateFileObjectDto } from '../../application/dtos/file_object.dto.js';

export function validateCreateFileObjectInput(dto: CreateFileObjectDto): void {
  if (!dto) {
    throw new Error('FileObject payload is required.');
  }
  if (!dto.filename || dto.filename.trim().length === 0) {
    throw new Error('FileObject filename is required.');
  }
  if (!dto.mimeType || dto.mimeType.trim().length === 0) {
    throw new Error('FileObject mimeType is required.');
  }
  if (typeof dto.sizeBytes !== 'number' || dto.sizeBytes < 0) {
    throw new Error('FileObject sizeBytes must be a non-negative number.');
  }
  if (!dto.storagePath || dto.storagePath.trim().length === 0) {
    throw new Error('FileObject storagePath is required.');
  }
  if (!dto.checksum || dto.checksum.trim().length === 0) {
    throw new Error('FileObject checksum is required.');
  }
}

export function sanitizeFilename(filename: string): string {
  // Remove directory traversal characters
  return filename.replace(/(\.\.[\/\\])+/g, '').replace(/[<>:"/\\|?*]/g, '_');
}
