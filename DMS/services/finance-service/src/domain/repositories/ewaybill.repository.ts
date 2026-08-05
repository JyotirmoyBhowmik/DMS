import { EWayBill, EWayBillStatus } from '../entities/ewaybill.entity.js';

export interface ListEWayBillsOptions {
  page?: number;
  limit?: number;
  status?: EWayBillStatus;
  invoiceId?: string;
  sortBy?: 'createdAt' | 'ewayBillNumber' | 'distanceKm';
  sortOrder?: 'ASC' | 'DESC';
}

export interface EWayBillRepository {
  save(ewaybill: EWayBill, tenantId: string): Promise<EWayBill>;
  findById(id: string, tenantId: string): Promise<EWayBill | null>;
  findByEWayBillNumber(ewayBillNumber: string, tenantId: string): Promise<EWayBill | null>;
  list(tenantId: string, options?: ListEWayBillsOptions): Promise<{ items: EWayBill[]; total: number }>;
  update(ewaybill: EWayBill, tenantId: string): Promise<EWayBill>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
