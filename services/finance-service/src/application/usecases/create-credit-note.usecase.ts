import { CreditNoteRepository } from '../../domain/repositories/credit-note.repository.js';
import { CreditNote, CreditNoteDomainError } from '../../domain/entities/credit-note.entity.js';
import { CreateCreditNoteDto } from '../dtos/credit-note.dto.js';
import { validateCreateCreditNoteInput } from '../../domain/validation/credit-note.validation.js';
import { Principal } from './create-invoice.usecase.js';

export class CreateCreditNoteUseCase {
  constructor(private readonly repository: CreditNoteRepository) {}

  async execute(principal: Principal, dto: CreateCreditNoteDto, idempotencyKey?: string): Promise<CreditNote> {
    if (!principal || !principal.tenantId) {
      throw new CreditNoteDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:credit_note:create') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new CreditNoteDomainError('Forbidden: Insufficient permissions to create credit note');
    }

    validateCreateCreditNoteInput(dto);

    const effectiveIdempotencyKey = idempotencyKey || dto.idempotencyKey;

    if (effectiveIdempotencyKey) {
      const existing = await this.repository.findByCreditNoteNumber(dto.creditNoteNumber, principal.tenantId);
      if (existing && existing.idempotencyKey === effectiveIdempotencyKey) {
        return existing;
      }
    }

    const duplicate = await this.repository.findByCreditNoteNumber(dto.creditNoteNumber, principal.tenantId);
    if (duplicate) {
      throw new CreditNoteDomainError(`CreditNote with number '${dto.creditNoteNumber}' already exists`);
    }

    const creditNote = new CreditNote({
      tenantId: principal.tenantId,
      distributorId: dto.distributorId,
      invoiceId: dto.invoiceId,
      creditNoteNumber: dto.creditNoteNumber,
      amountCents: dto.amountCents,
      currency: dto.currency || 'USD',
      reason: dto.reason,
      status: 'DRAFT',
      idempotencyKey: effectiveIdempotencyKey,
      version: 1,
    });

    const saved = await this.repository.save(creditNote, principal.tenantId);
    return saved;
  }
}
