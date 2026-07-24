import { DebitNoteRepository } from '../../domain/repositories/debit-note.repository.js';
import { DebitNote, DebitNoteDomainError } from '../../domain/entities/debit-note.entity.js';
import { CreateDebitNoteDto } from '../dtos/debit-note.dto.js';
import { validateCreateDebitNoteInput } from '../../domain/validation/debit-note.validation.js';
import { Principal } from './create-invoice.usecase.js';
import { DebitNoteAuditService } from '../../infrastructure/audit/debit-note.audit.js';

export class CreateDebitNoteUseCase {
  private auditService = new DebitNoteAuditService();

  constructor(private readonly repository: DebitNoteRepository) {}

  async execute(principal: Principal, dto: CreateDebitNoteDto, idempotencyKey?: string, correlationId?: string): Promise<DebitNote> {
    if (!principal || !principal.tenantId) {
      throw new DebitNoteDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:debit_note:create') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new DebitNoteDomainError('Forbidden: Insufficient permissions to create debit note (finance:debit_note:create required)');
    }

    validateCreateDebitNoteInput(dto);

    const effectiveIdempotencyKey = idempotencyKey || dto.idempotencyKey;

    if (effectiveIdempotencyKey) {
      const existing = await this.repository.findByDebitNoteNumber(dto.debitNoteNumber, principal.tenantId);
      if (existing && existing.idempotencyKey === effectiveIdempotencyKey) {
        return existing;
      }
    }

    const duplicate = await this.repository.findByDebitNoteNumber(dto.debitNoteNumber, principal.tenantId);
    if (duplicate) {
      throw new DebitNoteDomainError(`DebitNote with number '${dto.debitNoteNumber}' already exists`);
    }

    const debitNote = new DebitNote({
      tenantId: principal.tenantId,
      distributorId: dto.distributorId,
      invoiceId: dto.invoiceId,
      debitNoteNumber: dto.debitNoteNumber,
      amountCents: dto.amountCents,
      currency: dto.currency || 'USD',
      reason: dto.reason,
      status: 'DRAFT',
      idempotencyKey: effectiveIdempotencyKey,
      version: 1,
    });

    const saved = await this.repository.save(debitNote, principal.tenantId);

    // Audit logging hook
    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'DEBIT_NOTE_CREATED',
      entityType: 'DebitNote',
      entityId: saved.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      newValue: saved.toJSON(),
    });

    return saved;
  }
}
