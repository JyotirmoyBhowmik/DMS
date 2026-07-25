import { EWayBillRepository } from '../../domain/repositories/ewaybill.repository.js';
import { EWayBill, EWayBillDomainError } from '../../domain/entities/ewaybill.entity.js';
import { UpdateEWayBillDto } from '../dtos/ewaybill.dto.js';
import { validateUpdateEWayBillInput } from '../../domain/validation/ewaybill.validation.js';
import { Principal } from './create-invoice.usecase.js';
import { EWayBillAuditService } from '../../infrastructure/audit/ewaybill.audit.js';

export class UpdateEWayBillUseCase {
  private auditService = new EWayBillAuditService();

  constructor(private readonly repository: EWayBillRepository) {}

  async execute(id: string, principal: Principal, dto: UpdateEWayBillDto, correlationId?: string): Promise<EWayBill> {
    if (!principal || !principal.tenantId) {
      throw new EWayBillDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:ewaybill:update') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new EWayBillDomainError('Forbidden: Insufficient permissions to update eWayBill');
    }

    validateUpdateEWayBillInput(dto);

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new EWayBillDomainError(`EWayBill with id '${id}' not found`);
    }

    if (existing.version !== dto.version) {
      throw new EWayBillDomainError(
        `Optimistic locking conflict: eWayBill version is ${existing.version}, provided version is ${dto.version}`
      );
    }

    const oldValue = existing.toJSON();
    existing.transitionTo(dto.status);

    const updated = await this.repository.update(existing, principal.tenantId);

    // Audit trail
    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: `EWAYBILL_UPDATED_${dto.status}`,
      entityType: 'EWayBill',
      entityId: updated.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      oldValue,
      newValue: updated.toJSON(),
    });

    return updated;
  }
}
