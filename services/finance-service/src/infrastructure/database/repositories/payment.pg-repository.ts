import { PaymentRepository, ListPaymentsOptions, ListPaymentsResult } from '../../../domain/repositories/payment.repository.js';
import { Payment, PaymentDomainError } from '../../../domain/entities/payment.entity.js';

export class PaymentPgRepository implements PaymentRepository {
  private static inMemoryDb = new Map<string, Payment>();

  public static clearStore(): void {
    PaymentPgRepository.inMemoryDb.clear();
  }

  async save(payment: Payment, tenantId: string): Promise<Payment> {
    if (tenantId !== payment.tenantId) {
      throw new PaymentDomainError('Tenant isolation violation on save');
    }

    // Check unique constraint (tenant_id, payment_reference)
    for (const existing of PaymentPgRepository.inMemoryDb.values()) {
      if (
        existing.tenantId === tenantId &&
        existing.paymentReference === payment.paymentReference &&
        existing.id !== payment.id
      ) {
        throw new PaymentDomainError(`Payment with reference '${payment.paymentReference}' already exists`);
      }
    }

    PaymentPgRepository.inMemoryDb.set(payment.id, payment);
    return payment;
  }

  async findById(id: string, tenantId: string): Promise<Payment | null> {
    const found = PaymentPgRepository.inMemoryDb.get(id);
    if (!found || found.tenantId !== tenantId) {
      return null;
    }
    return found;
  }

  async findByPaymentReference(paymentReference: string, tenantId: string): Promise<Payment | null> {
    for (const item of PaymentPgRepository.inMemoryDb.values()) {
      if (item.tenantId === tenantId && item.paymentReference === paymentReference) {
        return item;
      }
    }
    return null;
  }

  async list(options: ListPaymentsOptions, tenantId: string): Promise<ListPaymentsResult> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 10));

    let items = Array.from(PaymentPgRepository.inMemoryDb.values()).filter(
      item => item.tenantId === tenantId
    );

    if (options.status) {
      items = items.filter(i => i.status === options.status);
    }

    if (options.distributorId) {
      items = items.filter(i => i.distributorId === options.distributorId);
    }

    if (options.invoiceId) {
      items = items.filter(i => i.invoiceId === options.invoiceId);
    }

    if (options.search) {
      const q = options.search.toLowerCase();
      items = items.filter(
        i =>
          i.paymentReference.toLowerCase().includes(q) ||
          i.distributorId.toLowerCase().includes(q)
      );
    }

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

  async update(payment: Payment, tenantId: string): Promise<Payment> {
    if (tenantId !== payment.tenantId) {
      throw new PaymentDomainError('Tenant isolation violation on update');
    }

    const existing = await this.findById(payment.id, tenantId);
    if (!existing) {
      throw new PaymentDomainError(`Payment with id '${payment.id}' not found`);
    }

    // Optimistic concurrency version check
    if (existing.version !== payment.version) {
      throw new PaymentDomainError(
        `Version conflict: Expected version ${existing.version}, got ${payment.version}`
      );
    }

    PaymentPgRepository.inMemoryDb.set(payment.id, payment);
    return payment;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await this.findById(id, tenantId);
    if (existing) {
      PaymentPgRepository.inMemoryDb.delete(id);
    }
  }
}
