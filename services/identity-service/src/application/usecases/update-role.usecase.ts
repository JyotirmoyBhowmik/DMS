import { RoleRepository } from '../../domain/repositories/role.repository.js';
import { RoleAggregate, RoleDomainError } from '../../domain/entities/role.entity.js';
import { UpdateRoleDto } from '../dtos/role.dto.js';
import { validateUpdateRoleInput } from '../../domain/validation/role.validation.js';
import { Principal } from './create-user.usecase.js';
import { RoleAuditService } from '../../infrastructure/audit/role.audit.js';

export class UpdateRoleUseCase {
  private auditService = new RoleAuditService();

  constructor(private readonly repository: RoleRepository) {}

  async execute(id: string, principal: Principal, dto: UpdateRoleDto, correlationId?: string): Promise<RoleAggregate> {
    if (!principal || !principal.tenantId) {
      throw new RoleDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('identity:role:update') ||
      principal.permissions.includes('identity:*');

    if (!hasPermission) {
      throw new RoleDomainError('Forbidden: Insufficient permissions to update Role');
    }

    validateUpdateRoleInput(dto);

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new RoleDomainError(`Role with id '${id}' not found`);
    }

    if (existing.version !== dto.version) {
      throw new RoleDomainError(
        `Optimistic locking conflict: Role version is ${existing.version}, provided version is ${dto.version}`
      );
    }

    const oldValue = existing.toJSON();
    
    if (dto.name || dto.description !== undefined) {
      existing.updateProfile(dto.name || existing.name, dto.description);
    }

    if (dto.status) {
      existing.transitionTo(dto.status);
    }

    const updated = await this.repository.update(existing, principal.tenantId);

    // Audit trail
    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: `ROLE_UPDATED_${dto.status || 'PROFILE'}`,
      entityType: 'Role',
      entityId: updated.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      oldValue,
      newValue: updated.toJSON(),
    });

    return updated;
  }
}
