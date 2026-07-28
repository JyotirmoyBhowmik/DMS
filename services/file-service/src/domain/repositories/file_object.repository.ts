import { FileObjectAggregate, FileObjectStatus } from '../entities/file_object.entity.js';

export interface FileObjectFilter {
  tenantId: string;
  filename?: string;
  mimeType?: string;
  status?: FileObjectStatus;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'filename' | 'sizeBytes';
  sortOrder?: 'asc' | 'desc';
}

export interface FileObjectRepository {
  save(fileObject: FileObjectAggregate): Promise<FileObjectAggregate>;
  findById(id: string, tenantId: string): Promise<FileObjectAggregate | null>;
  findAll(filter: FileObjectFilter): Promise<{ fileObjects: FileObjectAggregate[]; total: number; page: number; pageSize: number }>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
