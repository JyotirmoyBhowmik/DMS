import { CollectionRepository, ListCollectionsOptions, ListCollectionsResult } from '../../../domain/repositories/collection.repository.js';
import { Collection, CollectionDomainError } from '../../../domain/entities/collection.entity.js';

export class CollectionPgRepository implements CollectionRepository {
  private static inMemoryDb = new Map<string, Collection>();

  public static clearStore(): void {
    CollectionPgRepository.inMemoryDb.clear();
  }

  async save(collection: Collection, tenantId: string): Promise<Collection> {
    if (tenantId !== collection.tenantId) {
      throw new CollectionDomainError('Tenant isolation violation on save');
    }

    // Check unique constraint (tenant_id, collection_reference)
    for (const existing of CollectionPgRepository.inMemoryDb.values()) {
      if (
        existing.tenantId === tenantId &&
        existing.collectionReference === collection.collectionReference &&
        existing.id !== collection.id
      ) {
        throw new CollectionDomainError(`Collection with reference '${collection.collectionReference}' already exists`);
      }
    }

    CollectionPgRepository.inMemoryDb.set(collection.id, collection);
    return collection;
  }

  async findById(id: string, tenantId: string): Promise<Collection | null> {
    const found = CollectionPgRepository.inMemoryDb.get(id);
    if (!found || found.tenantId !== tenantId) {
      return null;
    }
    return found;
  }

  async findByCollectionReference(collectionReference: string, tenantId: string): Promise<Collection | null> {
    for (const item of CollectionPgRepository.inMemoryDb.values()) {
      if (item.tenantId === tenantId && item.collectionReference === collectionReference) {
        return item;
      }
    }
    return null;
  }

  async list(options: ListCollectionsOptions, tenantId: string): Promise<ListCollectionsResult> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 10));

    let items = Array.from(CollectionPgRepository.inMemoryDb.values()).filter(
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
          i.collectionReference.toLowerCase().includes(q) ||
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

  async update(collection: Collection, tenantId: string): Promise<Collection> {
    if (tenantId !== collection.tenantId) {
      throw new CollectionDomainError('Tenant isolation violation on update');
    }

    const existing = await this.findById(collection.id, tenantId);
    if (!existing) {
      throw new CollectionDomainError(`Collection with id '${collection.id}' not found`);
    }

    // Optimistic concurrency version check
    if (existing.version !== collection.version) {
      throw new CollectionDomainError(
        `Version conflict: Expected version ${existing.version}, got ${collection.version}`
      );
    }

    const updatedCollection = new Collection({
      ...collection.toJSON(),
      invoiceId: collection.invoiceId,
      idempotencyKey: collection.idempotencyKey,
      version: collection.version + 1,
      createdAt: collection.createdAt,
      updatedAt: new Date()
    });
    CollectionPgRepository.inMemoryDb.set(collection.id, updatedCollection);
    return updatedCollection;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await this.findById(id, tenantId);
    if (existing) {
      CollectionPgRepository.inMemoryDb.delete(id);
    }
  }
}
