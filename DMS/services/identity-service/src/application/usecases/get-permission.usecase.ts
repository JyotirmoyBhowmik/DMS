import { PermissionRepository } from '../../domain/repositories/permission.repository.js';
import {
  PermissionAggregate,
  PermissionDomainError,
} from '../../domain/entities/permission.entity.js';
import { Principal } from './create-user.usecase.js';

export class GetPermissionUseCase {
  constructor(private readonly repository: PermissionRepository) {}

  async execute(id: string, principal: Principal): Promise<PermissionAggregate> {
    if (!principal || !principal.tenantId) {
      throw new PermissionDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('identity:permission:read') ||
      principal.permissions.includes('identity:*');

    if (!hasPermission) {
      throw new PermissionDomainError('Forbidden: Insufficient permissions to read Permission');
    }

    const permission = await this.repository.findById(id, principal.tenantId);
    if (!permission) {
      throw new PermissionDomainError(`Permission with id '${id}' not found`);
    }

    return permission;
  }
}
