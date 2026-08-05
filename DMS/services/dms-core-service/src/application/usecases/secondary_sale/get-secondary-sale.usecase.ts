import { SecondarySale } from '../../../domain/entities/secondary_sale.js';
import { SecondarySalePgRepository } from '../../../infrastructure/database/repositories/secondary_sale.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetSecondarySaleUseCase {
  constructor(private saleRepo: SecondarySalePgRepository) {}

  async execute(principal: Principal, id: string): Promise<SecondarySale | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'secondary_sale:read') && !RbacGuard.can(principal, 'secondary_sales:read')) {
      throw new Error('Forbidden: Insufficient permissions to read secondary sale record');
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
