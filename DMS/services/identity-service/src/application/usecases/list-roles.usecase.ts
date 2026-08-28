import { RoleRepository, ListRolesOptions } from '../../domain/repositories/role.repository.js';
import { RoleAggregate, RoleDomainError } from '../../domain/entities/role.entity.js';
import { Principal } from './create-user.usecase.js';

export class ListRolesUseCase {
  constructor(private readonly repository: RoleRepository) {}

  async execute(
    principal: Principal,
    options?: ListRolesOptions,
  ): Promise<{ items: RoleAggregate[]; total: number; page: number; limit: number }> {
    if (!principal || !principal.tenantId) {
      throw new RoleDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('identity:role:read') ||
      principal.permissions.includes('identity:*');

    if (!hasPermission) {
      throw new RoleDomainError('Forbidden: Insufficient permissions to list Roles');
    }

    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(Math.max(1, options?.limit || 20), 100); // Mandatory max cap 100

    const { items, total } = await this.repository.list(principal.tenantId, {
      ...options,
      page,
      limit,
    });

    return {
      items,
      total,
      page,
      limit,
    };
  }
}
