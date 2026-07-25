import { OutstandingRepository } from '../../domain/repositories/outstanding.repository.js';
import { Outstanding, OutstandingDomainError } from '../../domain/entities/outstanding.entity.js';
import { UpdateOutstandingDto } from '../dtos/outstanding.dto.js';
import { Principal } from './create-invoice.usecase.js';
import { validateUpdateOutstandingInput } from '../../domain/validation/outstanding.validation.js';
import { OutstandingAuditService } from '../../infrastructure/audit/outstanding.audit.js';

export class UpdateOutstandingUseCase {
  private auditService = new OutstandingAuditService();

  constructor(private readonly repository: OutstandingRepository) {}

  async execute(principal: Principal, id: string, dto: UpdateOutstandingDto, correlationId?: string): Promise<Outstanding> {
    if (!principal || !principal.tenantId) {
      throw new OutstandingDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const isApproveAction = dto.status === 'PAID' || dto.status === 'WRITTEN_OFF';
    const requiredPermission = isApproveAction ? 'finance:outstanding:approve' : 'finance:outstanding:update';

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes(requiredPermission) ||
      principal.permissions.includes('finance:outstanding:update') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new OutstandingDomainError(`Forbidden: Insufficient permissions to update outstanding record (${requiredPermission} required)`);
    }

    validateUpdateOutstandingInput(dto);

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new OutstandingDomainError(`Outstanding record with id '${id}' not found`);
    }

    if (existing.version !== dto.version) {
      throw new OutstandingDomainError(
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
      action: `OUTSTANDING_UPDATED_${dto.status || 'STATE'}`,
      entityType: 'Outstanding',
      entityId: updated.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      oldValue,
      newValue: updated.toJSON(),
    });

    return updated;
  }
}
