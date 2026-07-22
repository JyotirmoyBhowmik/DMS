import { PrimarySale } from '../../../domain/entities/primary_sale.js';
import { PrimarySalePgRepository } from '../../../infrastructure/database/repositories/primary_sale.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetPrimarySaleUseCase {
  constructor(private saleRepo: PrimarySalePgRepository) {}

  async execute(principal: Principal, id: string): Promise<PrimarySale | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'primary_sale:read') && !RbacGuard.can(principal, 'primary_sales:read')) {
      throw new Error('Forbidden: Insufficient permissions to read primary sale record');
    }

    // 2. Fetch record scoped to tenant
    const sale = await this.saleRepo.findById(principal.tenantId, id);

    // 3. Prevent cross-tenant existence leakage
    if (!sale || sale.tenantId !== principal.tenantId) {
      return null;
    }

    return sale;
  }
}
