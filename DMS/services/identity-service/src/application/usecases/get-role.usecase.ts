import { RoleRepository } from '../../domain/repositories/role.repository.js';
import { RoleAggregate, RoleDomainError } from '../../domain/entities/role.entity.js';
import { Principal } from './create-user.usecase.js';

export class GetRoleUseCase {
  constructor(private readonly repository: RoleRepository) {}

  async execute(id: string, principal: Principal): Promise<RoleAggregate> {
    if (!principal || !principal.tenantId) {
      throw new RoleDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('identity:role:read') ||
      principal.permissions.includes('identity:*');

    if (!hasPermission) {
      throw new RoleDomainError('Forbidden: Insufficient permissions to read Role');
    }

    const role = await this.repository.findById(id, principal.tenantId);
    if (!role) {
      throw new RoleDomainError(`Role with id '${id}' not found`);
    }

    return role;
  }
}
