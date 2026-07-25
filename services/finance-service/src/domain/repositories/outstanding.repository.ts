import { Outstanding, OutstandingStatus } from '../entities/outstanding.entity.js';

export interface ListOutstandingsOptions {
  page?: number;
  limit?: number;
  status?: OutstandingStatus;
  distributorId?: string;
  invoiceId?: string;
  search?: string;
  sortField?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface ListOutstandingsResult {
  data: Outstanding[];
  total: number;
  page: number;
  limit: number;
}

export interface OutstandingRepository {
  save(outstanding: Outstanding, tenantId: string): Promise<Outstanding>;
  findById(id: string, tenantId: string): Promise<Outstanding | null>;
  findByOutstandingReference(outstandingReference: string, tenantId: string): Promise<Outstanding | null>;
  list(options: ListOutstandingsOptions, tenantId: string): Promise<ListOutstandingsResult>;
  update(outstanding: Outstanding, tenantId: string): Promise<Outstanding>;
  delete(id: string, tenantId: string): Promise<void>;
}
