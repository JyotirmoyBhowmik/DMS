import { OutstandingRepository, ListOutstandingsResult } from '../../domain/repositories/outstanding.repository.js';
import { OutstandingDomainError } from '../../domain/entities/outstanding.entity.js';
import { ListOutstandingsQueryDto } from '../dtos/outstanding.dto.js';
import { Principal } from './create-invoice.usecase.js';

export class ListOutstandingsUseCase {
  constructor(private readonly repository: OutstandingRepository) {}

  async execute(principal: Principal, query: ListOutstandingsQueryDto): Promise<ListOutstandingsResult> {
    if (!principal || !principal.tenantId) {
      throw new OutstandingDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:outstanding:list') ||
      principal.permissions.includes('finance:outstanding:read') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new OutstandingDomainError('Forbidden: Insufficient permissions to list outstanding records');
    }

    const allowedSortFields = ['createdAt', 'updatedAt', 'amountCents', 'outstandingReference', 'dueDate', 'status'];
    if (query.sortField && !allowedSortFields.includes(query.sortField)) {
      throw new OutstandingDomainError(`Invalid sort field '${query.sortField}'. Allowed fields: ${allowedSortFields.join(', ')}`);
    }

    const options = {
      page: Math.max(1, query.page || 1),
      limit: Math.min(100, Math.max(1, query.limit || 10)),
      status: query.status,
      distributorId: query.distributorId,
      invoiceId: query.invoiceId,
      search: query.search,
      sortField: query.sortField || 'createdAt',
      sortOrder: query.sortOrder || 'DESC',
    };

    return this.repository.list(options, principal.tenantId);
  }
}
