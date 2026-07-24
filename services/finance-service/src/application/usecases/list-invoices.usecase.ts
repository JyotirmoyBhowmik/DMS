import { InvoiceRepository, ListInvoicesResult } from '../../domain/repositories/invoice.repository.js';
import { InvoiceDomainError } from '../../domain/entities/invoice.entity.js';
import { ListInvoicesQueryDto } from '../dtos/invoice.dto.js';
import { Principal } from './create-invoice.usecase.js';

export class ListInvoicesUseCase {
  constructor(private readonly repository: InvoiceRepository) {}

  async execute(principal: Principal, query: ListInvoicesQueryDto = {}): Promise<ListInvoicesResult> {
    if (!principal || !principal.tenantId) {
      throw new InvoiceDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:invoice:read') ||
      principal.permissions.includes('finance:invoice:list') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new InvoiceDomainError('Forbidden: Insufficient permissions to list invoices');
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));

    // Whitelist sort fields
    const allowedSortFields = ['createdAt', 'updatedAt', 'invoiceNumber', 'dueDate', 'netAmountCents', 'status'];
    const sortField = allowedSortFields.includes(query.sortField || '') ? query.sortField : 'createdAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    return this.repository.list(
      {
        page,
        limit,
        status: query.status,
        distributorId: query.distributorId,
        search: query.search,
        sortField,
        sortOrder,
      },
      principal.tenantId
    );
  }
}
