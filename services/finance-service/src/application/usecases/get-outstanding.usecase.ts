import { OutstandingRepository } from '../../domain/repositories/outstanding.repository.js';
import { Outstanding, OutstandingDomainError } from '../../domain/entities/outstanding.entity.js';
import { Principal } from './create-invoice.usecase.js';

export class GetOutstandingUseCase {
  constructor(private readonly repository: OutstandingRepository) {}

  async execute(principal: Principal, id: string): Promise<Outstanding> {
    if (!principal || !principal.tenantId) {
      throw new OutstandingDomainError('Forbidden: Valid principal and tenantId are required');
    }

    const hasPermission =
      principal.roles.includes('admin') ||
      principal.permissions.includes('finance:outstanding:read') ||
      principal.permissions.includes('finance:*');

    if (!hasPermission) {
      throw new OutstandingDomainError('Forbidden: Insufficient permissions to read outstanding record');
    }

    const outstanding = await this.repository.findById(id, principal.tenantId);
    if (!outstanding) {
      throw new OutstandingDomainError(`Outstanding record with id '${id}' not found`);
    }

    return outstanding;
  }
}
