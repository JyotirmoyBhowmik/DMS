import { PermissionStatus } from '../../domain/entities/permission.entity.js';

export interface CreatePermissionDto {
  name: string;
  resource: string;
  action: string;
  description?: string;
  idempotencyKey?: string;
}

export interface UpdatePermissionDto {
  name?: string;
  resource?: string;
  action?: string;
  description?: string;
  status?: PermissionStatus;
  version: number;
}

export interface PermissionResponseDto {
  id: string;
  tenantId: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
  status: PermissionStatus;
  idempotencyKey?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
