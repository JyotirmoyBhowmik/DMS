import { PriceList } from '../../domain/entities/price_list.js';
import { PriceListPgRepository } from '../../infrastructure/database/repositories/price_list.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetPriceListUseCase {
  constructor(private listRepo: PriceListPgRepository) {}

  async execute(principal: Principal, id: string): Promise<PriceList | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'price_list:read') && !RbacGuard.can(principal, 'price_lists:read')) {
      throw new Error('Forbidden: Insufficient permissions to read price list record');
    }

    // 2. Fetch record scoped to tenant
    const list = await this.listRepo.findById(principal.tenantId, id);

    // 3. Prevent cross-tenant existence leakage
    if (!list || list.tenantId !== principal.tenantId) {
      return null;
    }

    return list;
  }
}
