import { DebitNoteRepository } from '../../domain/repositories/debit-note.repository.js';
import { DebitNote, DebitNoteDomainError } from '../../domain/entities/debit-note.entity.js';
import { Principal } from './create-invoice.usecase.js';

export class GetDebitNoteUseCase {
  constructor(private readonly repository: DebitNoteRepository) {}

  async execute(principal: Principal, id: string): Promise<DebitNote> {
    if (!principal || !principal.tenantId) {
      throw new DebitNoteDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:debit_note:read') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new DebitNoteDomainError('Forbidden: Insufficient permissions to read debit note');
    }

    const found = await this.repository.findById(id, principal.tenantId);
    if (!found) {
      throw new DebitNoteDomainError(`DebitNote with id '${id}' not found`);
    }

    return found;
  }
}
