import { RoleRepository } from '../../domain/repositories/role.repository.js';
import { RoleAggregate, RoleDomainError } from '../../domain/entities/role.entity.js';
import { CreateRoleDto } from '../dtos/role.dto.js';
import { validateCreateRoleInput } from '../../domain/validation/role.validation.js';
import { Principal } from './create-user.usecase.js';
import { RoleAuditService } from '../../infrastructure/audit/role.audit.js';

export class CreateRoleUseCase {
  private auditService = new RoleAuditService();

  constructor(private readonly repository: RoleRepository) {}

  async execute(
    principal: Principal,
    dto: CreateRoleDto,
    idempotencyKey?: string,
    correlationId?: string,
  ): Promise<RoleAggregate> {
    if (!principal || !principal.tenantId) {
      throw new RoleDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('identity:role:create') ||
      principal.permissions.includes('identity:*');

    if (!hasPermission) {
      throw new RoleDomainError('Forbidden: Insufficient permissions to create Role');
    }

    validateCreateRoleInput(dto);

    const effectiveIdempotencyKey = idempotencyKey || dto.idempotencyKey;

    if (effectiveIdempotencyKey && this.repository.findByName) {
      const existing = await this.repository.findByName(dto.name, principal.tenantId);
      if (existing && existing.idempotencyKey === effectiveIdempotencyKey) {
        return existing;
      }
    }

    if (this.repository.findByName) {
      const duplicate = await this.repository.findByName(dto.name, principal.tenantId);
      if (duplicate) {
        throw new RoleDomainError(`Role with name '${dto.name}' already exists`);
      }
    }

    const role = new RoleAggregate({
      tenantId: principal.tenantId,
      name: dto.name,
      description: dto.description,
      isSystem: dto.isSystem || false,
      status: 'ACTIVE',
      idempotencyKey: effectiveIdempotencyKey,
      version: 1,
    });

    const saved = await this.repository.save(role, principal.tenantId);

    // Audit trail
    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'ROLE_CREATED',
      entityType: 'Role',
      entityId: saved.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      newValue: saved.toJSON(),
    });

    return saved;
  }
}
