/**
 * Invoice Repository Interface (Port).
 */
import { Invoice, InvoiceStatus } from '../entities/invoice.js';

export abstract class InvoiceRepository {
  abstract save(invoice: Invoice): Promise<void>;
  abstract findById(tenantId: string, id: string): Promise<Invoice | null>;
  abstract findByInvoiceNumber(tenantId: string, invoiceNumber: string): Promise<Invoice | null>;
  abstract findByDistributor(tenantId: string, distributorId: string): Promise<Invoice[]>;
  abstract findByStatus(tenantId: string, status: InvoiceStatus): Promise<Invoice[]>;
  abstract findOverdue(tenantId: string): Promise<Invoice[]>;
  abstract findAll(tenantId: string): Promise<Invoice[]>;
  abstract getNextSequence(tenantId: string): Promise<number>;
  abstract delete(tenantId: string, id: string): Promise<void>;
}
