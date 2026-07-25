import { PermissionRepository, ListPermissionsOptions } from '../../domain/repositories/permission.repository.js';
import { PermissionAggregate, PermissionDomainError } from '../../domain/entities/permission.entity.js';
import { Principal } from './create-user.usecase.js';

export class ListPermissionsUseCase {
  constructor(private readonly repository: PermissionRepository) {}

  async execute(principal: Principal, options?: ListPermissionsOptions): Promise<{ items: PermissionAggregate[]; total: number; page: number; limit: number }> {
    if (!principal || !principal.tenantId) {
      throw new PermissionDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('identity:permission:read') ||
      principal.permissions.includes('identity:*');

    if (!hasPermission) {
      throw new PermissionDomainError('Forbidden: Insufficient permissions to list Permissions');
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
