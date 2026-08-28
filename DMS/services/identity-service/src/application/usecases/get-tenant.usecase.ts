import { TenantRepository } from '../../domain/repositories/tenant.repository.js';
import { TenantAggregate, TenantDomainError } from '../../domain/entities/tenant.entity.js';
import { Principal } from './create-user.usecase.js';

export class GetTenantUseCase {
  constructor(private readonly repository: TenantRepository) {}

  async execute(
    principal: Principal,
    tenantEntityId: string,
    correlationId?: string,
  ): Promise<TenantAggregate> {
    if (!principal || !principal.tenantId) {
      throw new TenantDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('identity:tenant:read') ||
      principal.permissions.includes('identity:*');

    if (!hasPermission) {
      throw new TenantDomainError('Forbidden: Insufficient permissions to read Tenant');
    }

    const tenant = await this.repository.findById(tenantEntityId, principal.tenantId);
    if (!tenant) {
      throw new TenantDomainError(`Tenant with id '${tenantEntityId}' not found`);
    }

    return tenant;
  }
}
