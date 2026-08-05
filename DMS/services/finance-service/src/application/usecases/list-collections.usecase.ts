import { CollectionRepository, ListCollectionsResult } from '../../domain/repositories/collection.repository.js';
import { CollectionDomainError } from '../../domain/entities/collection.entity.js';
import { ListCollectionsQueryDto } from '../dtos/collection.dto.js';
import { Principal } from './create-invoice.usecase.js';

export class ListCollectionsUseCase {
  constructor(private readonly repository: CollectionRepository) {}

  async execute(principal: Principal, query: ListCollectionsQueryDto = {}): Promise<ListCollectionsResult> {
    if (!principal || !principal.tenantId) {
      throw new CollectionDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:collection:read') ||
      principal.permissions.includes('finance:collection:list') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new CollectionDomainError('Forbidden: Insufficient permissions to list collections');
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));

    const allowedSortFields = ['createdAt', 'updatedAt', 'collectionReference', 'amountCents', 'status'];
    const sortField = allowedSortFields.includes(query.sortField || '') ? query.sortField : 'createdAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    return this.repository.list(
      {
        page,
        limit,
        status: query.status,
        distributorId: query.distributorId,
        invoiceId: query.invoiceId,
        search: query.search,
        sortField,
        sortOrder,
      },
      principal.tenantId
    );
  }
}
