import { CollectionRepository } from '../../domain/repositories/collection.repository.js';
import { Collection, CollectionDomainError } from '../../domain/entities/collection.entity.js';
import { Principal } from './create-invoice.usecase.js';

export class GetCollectionUseCase {
  constructor(private readonly repository: CollectionRepository) {}

  async execute(principal: Principal, id: string): Promise<Collection> {
    if (!principal || !principal.tenantId) {
      throw new CollectionDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:collection:read') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new CollectionDomainError('Forbidden: Insufficient permissions to read collection');
    }

    const found = await this.repository.findById(id, principal.tenantId);
    if (!found) {
      throw new CollectionDomainError(`Collection with id '${id}' not found`);
    }

    return found;
  }
}
