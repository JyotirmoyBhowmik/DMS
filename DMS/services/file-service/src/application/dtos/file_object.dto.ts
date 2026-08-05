import { FileObjectStatus } from '../../domain/entities/file_object.entity.js';

export interface CreateFileObjectDto {
  id?: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  checksum: string;
  idempotencyKey?: string;
}

export interface UpdateFileObjectDto {
  filename?: string;
  status?: FileObjectStatus;
  expectedVersion: number;
}

export interface FileObjectResponseDto {
  id: string;
  tenantId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  checksum: string;
  status: FileObjectStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListFileObjectsQueryDto {
  filename?: string;
  mimeType?: string;
  status?: FileObjectStatus;
  page?: number;
  pageSize?: number;
}
