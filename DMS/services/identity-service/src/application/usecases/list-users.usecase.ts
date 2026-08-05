import { UserRepository, ListUsersOptions } from '../../domain/repositories/user.repository.js';
import { UserAggregate, UserDomainError } from '../../domain/entities/user.entity.js';
import { Principal } from './create-user.usecase.js';

export class ListUsersUseCase {
  constructor(private readonly repository: UserRepository) {}

  async execute(principal: Principal, options?: ListUsersOptions): Promise<{ items: UserAggregate[]; total: number; page: number; limit: number }> {
    if (!principal || !principal.tenantId) {
      throw new UserDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('identity:user:read') ||
      principal.permissions.includes('identity:*');

    if (!hasPermission) {
      throw new UserDomainError('Forbidden: Insufficient permissions to list Users');
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
