import { TenantStatus } from '../../domain/entities/tenant.entity.js';

export interface CreateTenantDto {
  name: string;
  code: string;
  domain?: string;
  idempotencyKey?: string;
}

export interface UpdateTenantDto {
  name?: string;
  domain?: string;
  status?: TenantStatus;
  version: number;
}

export interface TenantResponseDto {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  domain?: string;
  status: TenantStatus;
  idempotencyKey?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
