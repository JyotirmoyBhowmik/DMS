import { TenantRepository } from '../../domain/repositories/tenant.repository.js';
import { TenantAggregate, TenantDomainError, TenantStatus } from '../../domain/entities/tenant.entity.js';
import { UpdateTenantDto } from '../dtos/tenant.dto.js';
import { validateUpdateTenantInput } from '../../domain/validation/tenant.validation.js';
import { Principal } from './create-user.usecase.js';
import { TenantAuditService } from '../../infrastructure/audit/tenant.audit.js';

export class UpdateTenantUseCase {
  private auditService = new TenantAuditService();

  constructor(private readonly repository: TenantRepository) {}

  async execute(principal: Principal, tenantEntityId: string, dto: UpdateTenantDto, correlationId?: string): Promise<TenantAggregate> {
    if (!principal || !principal.tenantId) {
      throw new TenantDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('identity:tenant:update') ||
      principal.permissions.includes('identity:*');

    if (!hasPermission) {
      throw new TenantDomainError('Forbidden: Insufficient permissions to update Tenant');
    }

    validateUpdateTenantInput(dto);

    const existing = await this.repository.findById(tenantEntityId, principal.tenantId);
    if (!existing) {
      throw new TenantDomainError(`Tenant with id '${tenantEntityId}' not found`);
    }

    if (dto.version !== undefined && existing.version !== dto.version) {
      throw new TenantDomainError(
        `Optimistic concurrency conflict for Tenant '${tenantEntityId}': expected v${dto.version}, found v${existing.version}`
      );
    }

    const oldValue = existing.toJSON();

    if (dto.name) {
      existing.updateProfile(dto.name, dto.domain !== undefined ? dto.domain : existing.domain);
    } else if (dto.domain !== undefined) {
      existing.updateProfile(existing.name, dto.domain);
    }

    if (dto.status && dto.status !== existing.status) {
      existing.transitionTo(dto.status as TenantStatus);
    }

    const updated = await this.repository.update(existing, principal.tenantId);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'TENANT_UPDATED',
      entityType: 'Tenant',
      entityId: updated.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      oldValue,
      newValue: updated.toJSON(),
    });

    return updated;
  }
}
