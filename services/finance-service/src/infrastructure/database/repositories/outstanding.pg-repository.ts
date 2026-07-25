import { OutstandingRepository, ListOutstandingsOptions, ListOutstandingsResult } from '../../../domain/repositories/outstanding.repository.js';
import { Outstanding, OutstandingDomainError } from '../../../domain/entities/outstanding.entity.js';

export class OutstandingPgRepository implements OutstandingRepository {
  private static inMemoryDb = new Map<string, Outstanding>();

  public static clearStore(): void {
    OutstandingPgRepository.inMemoryDb.clear();
  }

  async save(outstanding: Outstanding, tenantId: string): Promise<Outstanding> {
    if (tenantId !== outstanding.tenantId) {
      throw new OutstandingDomainError('Tenant isolation violation on save');
    }

    // Check unique constraint (tenant_id, outstanding_reference)
    for (const existing of OutstandingPgRepository.inMemoryDb.values()) {
      if (
        existing.tenantId === tenantId &&
        existing.outstandingReference === outstanding.outstandingReference &&
        existing.id !== outstanding.id
      ) {
        throw new OutstandingDomainError(`Outstanding record with reference '${outstanding.outstandingReference}' already exists`);
      }
    }

    OutstandingPgRepository.inMemoryDb.set(outstanding.id, outstanding);
    return outstanding;
  }

  async findById(id: string, tenantId: string): Promise<Outstanding | null> {
    const found = OutstandingPgRepository.inMemoryDb.get(id);
    if (!found || found.tenantId !== tenantId) {
      return null;
    }
    return found;
  }

  async findByOutstandingReference(outstandingReference: string, tenantId: string): Promise<Outstanding | null> {
    for (const item of OutstandingPgRepository.inMemoryDb.values()) {
      if (item.tenantId === tenantId && item.outstandingReference === outstandingReference) {
        return item;
      }
    }
    return null;
  }

  async list(options: ListOutstandingsOptions, tenantId: string): Promise<ListOutstandingsResult> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 10));

    let items = Array.from(OutstandingPgRepository.inMemoryDb.values()).filter(
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
          i.outstandingReference.toLowerCase().includes(q) ||
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

  async update(outstanding: Outstanding, tenantId: string): Promise<Outstanding> {
    if (tenantId !== outstanding.tenantId) {
      throw new OutstandingDomainError('Tenant isolation violation on update');
    }

    const existing = await this.findById(outstanding.id, tenantId);
    if (!existing) {
      throw new OutstandingDomainError(`Outstanding record with id '${outstanding.id}' not found`);
    }

    // Optimistic concurrency version check
    if (existing.version !== outstanding.version) {
      throw new OutstandingDomainError(
        `Version conflict: Expected version ${existing.version}, got ${outstanding.version}`
      );
    }

    const updatedOutstanding = new Outstanding({
      ...outstanding.toJSON(),
      invoiceId: outstanding.invoiceId,
      dueDate: outstanding.dueDate,
      idempotencyKey: outstanding.idempotencyKey,
      version: outstanding.version + 1,
      createdAt: outstanding.createdAt,
      updatedAt: new Date()
    });
    OutstandingPgRepository.inMemoryDb.set(outstanding.id, updatedOutstanding);
    return updatedOutstanding;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await this.findById(id, tenantId);
    if (existing) {
      OutstandingPgRepository.inMemoryDb.delete(id);
    }
  }
}
