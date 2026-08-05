import { PermissionRepository } from '../../domain/repositories/permission.repository.js';
import { PermissionAggregate, PermissionDomainError } from '../../domain/entities/permission.entity.js';
import { UpdatePermissionDto } from '../dtos/permission.dto.js';
import { validateUpdatePermissionInput } from '../../domain/validation/permission.validation.js';
import { Principal } from './create-user.usecase.js';
import { PermissionAuditService } from '../../infrastructure/audit/permission.audit.js';

export class UpdatePermissionUseCase {
  private auditService = new PermissionAuditService();

  constructor(private readonly repository: PermissionRepository) {}

  async execute(id: string, principal: Principal, dto: UpdatePermissionDto, correlationId?: string): Promise<PermissionAggregate> {
    if (!principal || !principal.tenantId) {
      throw new PermissionDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('identity:permission:update') ||
      principal.permissions.includes('identity:*');

    if (!hasPermission) {
      throw new PermissionDomainError('Forbidden: Insufficient permissions to update Permission');
    }

    validateUpdatePermissionInput(dto);

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new PermissionDomainError(`Permission with id '${id}' not found`);
    }

    if (dto.version !== undefined && existing.version !== dto.version) {
      throw new PermissionDomainError(
        `Optimistic locking conflict: Permission version is ${existing.version}, provided version is ${dto.version}`
      );
    }

    const oldValue = existing.toJSON();
    
    if (dto.name || dto.resource || dto.action || dto.description !== undefined) {
      existing.updateProfile(
        dto.name || existing.name,
        dto.resource || existing.resource,
        dto.action || existing.action,
        dto.description
      );
    }

    if (dto.status) {
      existing.transitionTo(dto.status);
    }

    const updated = await this.repository.update(existing, principal.tenantId);

    // Audit trail
    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: `PERMISSION_UPDATED_${dto.status || 'PROFILE'}`,
      entityType: 'Permission',
      entityId: updated.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      oldValue,
      newValue: updated.toJSON(),
    });

    return updated;
  }
}
