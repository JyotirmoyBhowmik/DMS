import { DebitNoteRepository, ListDebitNotesResult } from '../../domain/repositories/debit-note.repository.js';
import { DebitNoteDomainError } from '../../domain/entities/debit-note.entity.js';
import { ListDebitNotesQueryDto } from '../dtos/debit-note.dto.js';
import { Principal } from './create-invoice.usecase.js';

export class ListDebitNotesUseCase {
  constructor(private readonly repository: DebitNoteRepository) {}

  async execute(principal: Principal, query: ListDebitNotesQueryDto = {}): Promise<ListDebitNotesResult> {
    if (!principal || !principal.tenantId) {
      throw new DebitNoteDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:debit_note:read') ||
      principal.permissions.includes('finance:debit_note:list') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new DebitNoteDomainError('Forbidden: Insufficient permissions to list debit notes');
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));

    const allowedSortFields = ['createdAt', 'updatedAt', 'debitNoteNumber', 'amountCents', 'status'];
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
