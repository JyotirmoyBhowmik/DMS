import { RoleStatus } from '../../domain/entities/role.entity.js';

export interface CreateRoleDto {
  name: string;
  description?: string;
  isSystem?: boolean;
  idempotencyKey?: string;
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  status?: RoleStatus;
  version: number;
}

export interface RoleResponseDto {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  isSystem: boolean;
  status: RoleStatus;
  idempotencyKey?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
