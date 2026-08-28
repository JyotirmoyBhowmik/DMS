import { PermissionRepository } from '../../domain/repositories/permission.repository.js';
import {
  PermissionAggregate,
  PermissionDomainError,
} from '../../domain/entities/permission.entity.js';
import { CreatePermissionDto } from '../dtos/permission.dto.js';
import { validateCreatePermissionInput } from '../../domain/validation/permission.validation.js';
import { Principal } from './create-user.usecase.js';
import { PermissionAuditService } from '../../infrastructure/audit/permission.audit.js';

export class CreatePermissionUseCase {
  private auditService = new PermissionAuditService();

  constructor(private readonly repository: PermissionRepository) {}

  async execute(
    principal: Principal,
    dto: CreatePermissionDto,
    idempotencyKey?: string,
    correlationId?: string,
  ): Promise<PermissionAggregate> {
    if (!principal || !principal.tenantId) {
      throw new PermissionDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('identity:permission:create') ||
      principal.permissions.includes('identity:*');

    if (!hasPermission) {
      throw new PermissionDomainError('Forbidden: Insufficient permissions to create Permission');
    }

    validateCreatePermissionInput(dto);

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
        throw new PermissionDomainError(`Permission with name '${dto.name}' already exists`);
      }
    }

    const permission = new PermissionAggregate({
      tenantId: principal.tenantId,
      name: dto.name,
      resource: dto.resource,
      action: dto.action,
      description: dto.description,
      status: 'ACTIVE',
      idempotencyKey: effectiveIdempotencyKey,
      version: 1,
    });

    const saved = await this.repository.save(permission, principal.tenantId);

    // Audit trail
    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'PERMISSION_CREATED',
      entityType: 'Permission',
      entityId: saved.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      newValue: saved.toJSON(),
    });

    return saved;
  }
}
