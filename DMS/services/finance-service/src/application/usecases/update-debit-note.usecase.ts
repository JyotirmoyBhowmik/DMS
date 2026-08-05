import { DebitNoteRepository } from '../../domain/repositories/debit-note.repository.js';
import { DebitNote, DebitNoteDomainError } from '../../domain/entities/debit-note.entity.js';
import { UpdateDebitNoteDto } from '../dtos/debit-note.dto.js';
import { Principal } from './create-invoice.usecase.js';
import { validateUpdateDebitNoteInput } from '../../domain/validation/debit-note.validation.js';
import { DebitNoteAuditService } from '../../infrastructure/audit/debit-note.audit.js';

export class UpdateDebitNoteUseCase {
  private auditService = new DebitNoteAuditService();

  constructor(private readonly repository: DebitNoteRepository) {}

  async execute(principal: Principal, id: string, dto: UpdateDebitNoteDto, correlationId?: string): Promise<DebitNote> {
    if (!principal || !principal.tenantId) {
      throw new DebitNoteDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const isApproveAction = dto.status === 'APPROVED' || dto.status === 'APPLIED';
    const requiredPermission = isApproveAction ? 'finance:debit_note:approve' : 'finance:debit_note:update';

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes(requiredPermission) ||
      principal.permissions.includes('finance:debit_note:update') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new DebitNoteDomainError(`Forbidden: Insufficient permissions to update debit note (${requiredPermission} required)`);
    }

    validateUpdateDebitNoteInput(dto);

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new DebitNoteDomainError(`DebitNote with id '${id}' not found`);
    }

    if (existing.version !== dto.version) {
      throw new DebitNoteDomainError(
        `Version conflict: Expected version ${existing.version}, got ${dto.version}`
      );
    }

    const oldValue = existing.toJSON();

    if (dto.status) {
      existing.transitionTo(dto.status);
    }

    const updated = await this.repository.update(existing, principal.tenantId);

    // Audit logging hook
    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: `DEBIT_NOTE_UPDATED_${dto.status || 'STATE'}`,
      entityType: 'DebitNote',
      entityId: updated.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      oldValue,
      newValue: updated.toJSON(),
    });

    return updated;
  }
}
