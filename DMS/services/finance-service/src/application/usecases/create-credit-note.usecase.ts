import { CreditNoteRepository } from '../../domain/repositories/credit-note.repository.js';
import { CreditNote, CreditNoteDomainError } from '../../domain/entities/credit-note.entity.js';
import { CreateCreditNoteDto } from '../dtos/credit-note.dto.js';
import { validateCreateCreditNoteInput } from '../../domain/validation/credit-note.validation.js';
import { Principal } from './create-invoice.usecase.js';
import { CreditNoteAuditService } from '../../infrastructure/audit/credit-note.audit.js';

export class CreateCreditNoteUseCase {
  private auditService = new CreditNoteAuditService();

  constructor(private readonly repository: CreditNoteRepository) {}

  async execute(principal: Principal, dto: CreateCreditNoteDto, idempotencyKey?: string, correlationId?: string): Promise<CreditNote> {
    if (!principal || !principal.tenantId) {
      throw new CreditNoteDomainError('Forbidden: Valid principal and tenantId are required');
    }

    // Default-deny granular permission check (Task 1262)
    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:credit_note:create') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new CreditNoteDomainError('Forbidden: Insufficient permissions to create credit note (finance:credit_note:create required)');
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

    // Audit logging hook (Task 1263)
    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'CREDIT_NOTE_CREATED',
      entityType: 'CreditNote',
      entityId: saved.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      newValue: saved.toJSON(),
    });

    return saved;
  }
}
