import { TertiarySale } from '../../../domain/entities/tertiary_sale.js';
import { TertiarySalePgRepository } from '../../../infrastructure/database/repositories/tertiary_sale.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetTertiarySaleUseCase {
  constructor(private saleRepo: TertiarySalePgRepository) {}

  async execute(principal: Principal, id: string): Promise<TertiarySale | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'tertiary_sale:read') && !RbacGuard.can(principal, 'tertiary_sales:read')) {
      throw new Error('Forbidden: Insufficient permissions to read tertiary sale record');
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
