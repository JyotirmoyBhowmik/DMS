import { OutstandingStatus } from '../../domain/entities/outstanding.entity.js';

export interface CreateOutstandingDto {
  distributorId: string;
  invoiceId?: string;
  outstandingReference: string;
  amountCents: number;
  dueDate?: string;
  idempotencyKey?: string;
}

export interface UpdateOutstandingDto {
  status?: OutstandingStatus;
  version: number;
}

export interface OutstandingResponseDto {
  id: string;
  tenantId: string;
  distributorId: string;
  invoiceId?: string;
  outstandingReference: string;
  amountCents: number;
  dueDate?: string;
  status: OutstandingStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListOutstandingsQueryDto {
  page?: number;
  limit?: number;
  status?: OutstandingStatus;
  distributorId?: string;
  invoiceId?: string;
  search?: string;
  sortField?: string;
  sortOrder?: 'ASC' | 'DESC';
}
