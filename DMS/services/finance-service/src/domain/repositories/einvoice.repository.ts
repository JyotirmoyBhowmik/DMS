import { EInvoice, EInvoiceStatus } from '../entities/einvoice.entity.js';

export interface ListEInvoicesOptions {
  page?: number;
  limit?: number;
  status?: EInvoiceStatus;
  invoiceId?: string;
  sortBy?: 'createdAt' | 'irn' | 'totalAmountCents';
  sortOrder?: 'ASC' | 'DESC';
}

export interface EInvoiceRepository {
  save(einvoice: EInvoice, tenantId: string): Promise<EInvoice>;
  findById(id: string, tenantId: string): Promise<EInvoice | null>;
  findByIrn(irn: string, tenantId: string): Promise<EInvoice | null>;
  list(tenantId: string, options?: ListEInvoicesOptions): Promise<{ items: EInvoice[]; total: number }>;
  update(einvoice: EInvoice, tenantId: string): Promise<EInvoice>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
