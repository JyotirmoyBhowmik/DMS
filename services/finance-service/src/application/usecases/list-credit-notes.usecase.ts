import { CreditNoteRepository, ListCreditNotesResult } from '../../domain/repositories/credit-note.repository.js';
import { CreditNoteDomainError } from '../../domain/entities/credit-note.entity.js';
import { ListCreditNotesQueryDto } from '../dtos/credit-note.dto.js';
import { Principal } from './create-invoice.usecase.js';

export class ListCreditNotesUseCase {
  constructor(private readonly repository: CreditNoteRepository) {}

  async execute(principal: Principal, query: ListCreditNotesQueryDto = {}): Promise<ListCreditNotesResult> {
    if (!principal || !principal.tenantId) {
      throw new CreditNoteDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:credit_note:read') ||
      principal.permissions.includes('finance:credit_note:list') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new CreditNoteDomainError('Forbidden: Insufficient permissions to list credit notes');
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));

    const allowedSortFields = ['createdAt', 'updatedAt', 'creditNoteNumber', 'amountCents', 'status'];
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
