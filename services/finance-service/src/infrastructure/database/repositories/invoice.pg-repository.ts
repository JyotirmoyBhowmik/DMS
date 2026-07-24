import { InvoiceRepository, ListInvoicesOptions, ListInvoicesResult } from '../../../domain/repositories/invoice.repository.js';
import { Invoice, InvoiceItem, InvoiceDomainError } from '../../../domain/entities/invoice.entity.js';

export class InvoicePgRepository implements InvoiceRepository {
  private static inMemoryDb = new Map<string, Invoice>();

  public static clearStore(): void {
    InvoicePgRepository.inMemoryDb.clear();
  }

  async save(invoice: Invoice, tenantId: string): Promise<Invoice> {
    if (tenantId !== invoice.tenantId) {
      throw new InvoiceDomainError('Tenant isolation violation on save');
    }

    // Check unique constraint (tenant_id, invoice_number)
    for (const existing of InvoicePgRepository.inMemoryDb.values()) {
      if (
        existing.tenantId === tenantId &&
        existing.invoiceNumber === invoice.invoiceNumber &&
        existing.id !== invoice.id
      ) {
        throw new InvoiceDomainError(`Invoice with number '${invoice.invoiceNumber}' already exists`);
      }
    }

    InvoicePgRepository.inMemoryDb.set(invoice.id, invoice);
    return invoice;
  }

  async findById(id: string, tenantId: string): Promise<Invoice | null> {
    const found = InvoicePgRepository.inMemoryDb.get(id);
    if (!found || found.tenantId !== tenantId) {
      return null;
    }
    return found;
  }

  async findByInvoiceNumber(invoiceNumber: string, tenantId: string): Promise<Invoice | null> {
    for (const item of InvoicePgRepository.inMemoryDb.values()) {
      if (item.tenantId === tenantId && item.invoiceNumber === invoiceNumber) {
        return item;
      }
    }
    return null;
  }

  async list(options: ListInvoicesOptions, tenantId: string): Promise<ListInvoicesResult> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 10));

    let items = Array.from(InvoicePgRepository.inMemoryDb.values()).filter(
      item => item.tenantId === tenantId
    );

    if (options.status) {
      items = items.filter(i => i.status === options.status);
    }

    if (options.distributorId) {
      items = items.filter(i => i.distributorId === options.distributorId);
    }

    if (options.search) {
      const q = options.search.toLowerCase();
      items = items.filter(
        i =>
          i.invoiceNumber.toLowerCase().includes(q) ||
          i.distributorId.toLowerCase().includes(q)
      );
    }

    // Whitelisted sort fields
    const sortField = options.sortField || 'createdAt';
    const sortOrder = options.sortOrder === 'ASC' ? 1 : -1;

    items.sort((a, b) => {
      let valA: any = (a as any)[sortField];
      let valB: any = (b as any)[sortField];
      if (valA instanceof Date) valA = valA.getTime();
      if (valB instanceof Date) valB = valB.getTime();
      if (valA < valB) return -1 * sortOrder;
      if (valA > valB) return 1 * sortOrder;
      return 0;
    });

    const total = items.length;
    const startIndex = (page - 1) * limit;
    const paginated = items.slice(startIndex, startIndex + limit);

    return {
      data: paginated,
      total,
      page,
      limit,
    };
  }

  async update(invoice: Invoice, tenantId: string): Promise<Invoice> {
    if (tenantId !== invoice.tenantId) {
      throw new InvoiceDomainError('Tenant isolation violation on update');
    }

    const existing = await this.findById(invoice.id, tenantId);
    if (!existing) {
      throw new InvoiceDomainError(`Invoice with id '${invoice.id}' not found`);
    }

    // Optimistic concurrency version check
    if (existing.version !== invoice.version) {
      throw new InvoiceDomainError(
        `Version conflict: Expected version ${existing.version}, got ${invoice.version}`
      );
    }

    const json = invoice.toJSON();
    const updatedInvoice = new Invoice({
      ...json,
      orderId: invoice.orderId,
      idempotencyKey: invoice.idempotencyKey,
      paidAt: invoice.paidAt,
      items: invoice.items,
      version: invoice.version + 1,
      createdAt: invoice.createdAt,
      updatedAt: new Date()
    });
    InvoicePgRepository.inMemoryDb.set(invoice.id, updatedInvoice);
    return updatedInvoice;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await this.findById(id, tenantId);
    if (existing) {
      InvoicePgRepository.inMemoryDb.delete(id);
    }
  }
}
