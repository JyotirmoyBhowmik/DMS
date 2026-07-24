import { CreditNoteRepository } from '../../domain/repositories/credit-note.repository.js';
import { CreditNote, CreditNoteDomainError } from '../../domain/entities/credit-note.entity.js';
import { UpdateCreditNoteDto } from '../dtos/credit-note.dto.js';
import { Principal } from './create-invoice.usecase.js';
import { validateUpdateCreditNoteInput } from '../../domain/validation/credit-note.validation.js';
import { CreditNoteAuditService } from '../../infrastructure/audit/credit-note.audit.js';

export class UpdateCreditNoteUseCase {
  private auditService = new CreditNoteAuditService();

  constructor(private readonly repository: CreditNoteRepository) {}

  async execute(principal: Principal, id: string, dto: UpdateCreditNoteDto, correlationId?: string): Promise<CreditNote> {
    if (!principal || !principal.tenantId) {
      throw new CreditNoteDomainError('Forbidden: Valid principal and tenantId are required');
    }

    // Default-deny permission check (Task 1262)
    const isApproveAction = dto.status === 'APPROVED' || dto.status === 'APPLIED';
    const requiredPermission = isApproveAction ? 'finance:credit_note:approve' : 'finance:credit_note:update';

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes(requiredPermission) ||
      principal.permissions.includes('finance:credit_note:update') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new CreditNoteDomainError(`Forbidden: Insufficient permissions to update credit note (${requiredPermission} required)`);
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

    const oldValue = existing.toJSON();

    if (dto.status) {
      existing.transitionTo(dto.status);
    }

    const updated = await this.repository.update(existing, principal.tenantId);

    // Audit logging hook (Task 1263)
    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: `CREDIT_NOTE_UPDATED_${dto.status || 'STATE'}`,
      entityType: 'CreditNote',
      entityId: updated.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      oldValue,
      newValue: updated.toJSON(),
    });

    return updated;
  }
}
