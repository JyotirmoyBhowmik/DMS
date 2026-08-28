import { TenantRepository } from '../../domain/repositories/tenant.repository.js';
import { TenantAggregate, TenantDomainError } from '../../domain/entities/tenant.entity.js';
import { CreateTenantDto } from '../dtos/tenant.dto.js';
import { validateCreateTenantInput } from '../../domain/validation/tenant.validation.js';
import { Principal } from './create-user.usecase.js';
import { TenantAuditService } from '../../infrastructure/audit/tenant.audit.js';

export class CreateTenantUseCase {
  private auditService = new TenantAuditService();

  constructor(private readonly repository: TenantRepository) {}

  async execute(
    principal: Principal,
    dto: CreateTenantDto,
    idempotencyKey?: string,
    correlationId?: string,
  ): Promise<TenantAggregate> {
    if (!principal || !principal.tenantId) {
      throw new TenantDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('identity:tenant:create') ||
      principal.permissions.includes('identity:*');

    if (!hasPermission) {
      throw new TenantDomainError('Forbidden: Insufficient permissions to create Tenant');
    }

    validateCreateTenantInput(dto);

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
        throw new TenantDomainError(`Tenant with name '${dto.name}' already exists`);
      }
    }

    const tenant = new TenantAggregate({
      tenantId: principal.tenantId,
      name: dto.name,
      code: dto.code,
      domain: dto.domain,
      status: 'ACTIVE',
      idempotencyKey: effectiveIdempotencyKey,
      version: 1,
    });

    const saved = await this.repository.save(tenant, principal.tenantId);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'TENANT_CREATED',
      entityType: 'Tenant',
      entityId: saved.id,
      correlationId: correlationId || 'N/A',
      source: 'API',
      newValue: saved.toJSON(),
    });

    return saved;
  }
}
