import { PaymentRepository, ListPaymentsResult } from '../../domain/repositories/payment.repository.js';
import { PaymentDomainError } from '../../domain/entities/payment.entity.js';
import { ListPaymentsQueryDto } from '../dtos/payment.dto.js';
import { Principal } from './create-invoice.usecase.js';

export class ListPaymentsUseCase {
  constructor(private readonly repository: PaymentRepository) {}

  async execute(principal: Principal, query: ListPaymentsQueryDto = {}): Promise<ListPaymentsResult> {
    if (!principal || !principal.tenantId) {
      throw new PaymentDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:payment:read') ||
      principal.permissions.includes('finance:payment:list') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new PaymentDomainError('Forbidden: Insufficient permissions to list payments');
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));

    const allowedSortFields = ['createdAt', 'updatedAt', 'paymentReference', 'amountCents', 'status'];
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
