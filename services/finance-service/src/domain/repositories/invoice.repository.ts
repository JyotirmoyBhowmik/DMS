import { Invoice } from '../entities/invoice.entity.js';

export interface ListInvoicesOptions {
  page?: number;
  limit?: number;
  status?: string;
  distributorId?: string;
  search?: string;
  sortField?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface ListInvoicesResult {
  data: Invoice[];
  total: number;
  page: number;
  limit: number;
}

export interface InvoiceRepository {
  save(invoice: Invoice, tenantId: string): Promise<Invoice>;
  findById(id: string, tenantId: string): Promise<Invoice | null>;
  findByInvoiceNumber(invoiceNumber: string, tenantId: string): Promise<Invoice | null>;
  list(options: ListInvoicesOptions, tenantId: string): Promise<ListInvoicesResult>;
  update(invoice: Invoice, tenantId: string): Promise<Invoice>;
  delete(id: string, tenantId: string): Promise<void>;
}
