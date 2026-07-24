import { CreditNoteRepository } from '../../domain/repositories/credit-note.repository.js';
import { CreditNote, CreditNoteDomainError } from '../../domain/entities/credit-note.entity.js';
import { UpdateCreditNoteDto } from '../dtos/credit-note.dto.js';
import { Principal } from './create-invoice.usecase.js';
import { validateUpdateCreditNoteInput } from '../../domain/validation/credit-note.validation.js';

export class UpdateCreditNoteUseCase {
  constructor(private readonly repository: CreditNoteRepository) {}

  async execute(principal: Principal, id: string, dto: UpdateCreditNoteDto): Promise<CreditNote> {
    if (!principal || !principal.tenantId) {
      throw new CreditNoteDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:credit_note:update') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new CreditNoteDomainError('Forbidden: Insufficient permissions to update credit note');
    }

    validateUpdateCreditNoteInput(dto);

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new CreditNoteDomainError(`CreditNote with id '${id}' not found`);
    }

    if (existing.version !== dto.version) {
      throw new CreditNoteDomainError(
        `Version conflict: Expected version ${existing.version}, got ${dto.version}`
      );
    }

    if (dto.status) {
      existing.transitionTo(dto.status);
    }

    const updated = await this.repository.update(existing, principal.tenantId);
    return updated;
  }
}
