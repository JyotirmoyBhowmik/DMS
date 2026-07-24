import { CreditNoteRepository } from '../../domain/repositories/credit-note.repository.js';
import { CreditNote, CreditNoteDomainError } from '../../domain/entities/credit-note.entity.js';
import { Principal } from './create-invoice.usecase.js';

export class GetCreditNoteUseCase {
  constructor(private readonly repository: CreditNoteRepository) {}

  async execute(principal: Principal, id: string): Promise<CreditNote> {
    if (!principal || !principal.tenantId) {
      throw new CreditNoteDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:credit_note:read') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new CreditNoteDomainError('Forbidden: Insufficient permissions to read credit note');
    }

    const found = await this.repository.findById(id, principal.tenantId);
    if (!found) {
      throw new CreditNoteDomainError(`CreditNote with id '${id}' not found`);
    }

    return found;
  }
}
