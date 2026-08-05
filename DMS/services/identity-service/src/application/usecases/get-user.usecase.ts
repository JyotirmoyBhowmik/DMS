import { UserRepository } from '../../domain/repositories/user.repository.js';
import { UserAggregate, UserDomainError } from '../../domain/entities/user.entity.js';
import { Principal } from './create-user.usecase.js';

export class GetUserUseCase {
  constructor(private readonly repository: UserRepository) {}

  async execute(id: string, principal: Principal): Promise<UserAggregate> {
    if (!principal || !principal.tenantId) {
      throw new UserDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('identity:user:read') ||
      principal.permissions.includes('identity:*');

    if (!hasPermission) {
      throw new UserDomainError('Forbidden: Insufficient permissions to read User');
    }

    const user = await this.repository.findById(id, principal.tenantId);
    if (!user) {
      throw new UserDomainError(`User with id '${id}' not found`);
    }

    return user;
  }
}
