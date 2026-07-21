import { Distributor } from '../../../domain/entities/distributor.js';
import { DistributorRepository } from '../../../domain/repositories/distributor.repository.js';
import { BusinessRuleViolationError, EntityNotFoundError } from '../../../domain/errors/domain-error.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetDistributorUseCase {
  constructor(private repo: DistributorRepository) {}

  async execute(principal: Principal, id: string, tenantId: string): Promise<Distributor> {
    // 1. Authorize: check tenant + RBAC permission
    if (principal.tenantId !== tenantId) {
      throw new BusinessRuleViolationError('Forbidden: Tenant boundary violation');
    }
    if (!RbacGuard.can(principal, 'distributor:read')) {
      throw new BusinessRuleViolationError('Forbidden: Insufficient permissions to read distributor');
    }

    try {
      const distributor = await this.repo.findById(id, tenantId);
      if (!distributor) {
        throw new EntityNotFoundError('Distributor', id);
      }
      return distributor;
    } catch {
      throw new EntityNotFoundError('Distributor', id);
    }
  }
}
