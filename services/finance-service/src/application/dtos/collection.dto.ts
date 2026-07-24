import { CollectionStatus } from '../../domain/entities/collection.entity.js';

export interface CreateCollectionDto {
  distributorId: string;
  invoiceId?: string;
  collectionReference: string;
  amountCents: number;
  collectionMode?: string;
  currency?: string;
  idempotencyKey?: string;
}

export interface UpdateCollectionDto {
  status?: CollectionStatus;
  version: number;
}

export interface ListCollectionsQueryDto {
  page?: number;
  limit?: number;
  status?: string;
  distributorId?: string;
  invoiceId?: string;
  search?: string;
  sortField?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface CollectionResponseDto {
  id: string;
  tenantId: string;
  distributorId: string;
  invoiceId?: string;
  collectionReference: string;
  amountCents: number;
  collectionMode: string;
  currency: string;
  status: CollectionStatus;
  idempotencyKey?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
