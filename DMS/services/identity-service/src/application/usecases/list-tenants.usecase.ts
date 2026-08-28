import {
  TenantRepository,
  ListTenantsOptions,
} from '../../domain/repositories/tenant.repository.js';
import { TenantDomainError } from '../../domain/entities/tenant.entity.js';
import { Principal } from './create-user.usecase.js';

export class ListTenantsUseCase {
  constructor(private readonly repository: TenantRepository) {}

  async execute(
    principal: Principal,
    options?: ListTenantsOptions,
    correlationId?: string,
  ): Promise<{ items: any[]; total: number; page: number; limit: number }> {
    if (!principal || !principal.tenantId) {
      throw new TenantDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('identity:tenant:read') ||
      principal.permissions.includes('identity:*');

    if (!hasPermission) {
      throw new TenantDomainError('Forbidden: Insufficient permissions to list Tenants');
    }

    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 100);

    const result = await this.repository.list(principal.tenantId, { ...options, page, limit });

    return {
      items: result.items,
      total: result.total,
      page,
      limit,
    };
  }
}
