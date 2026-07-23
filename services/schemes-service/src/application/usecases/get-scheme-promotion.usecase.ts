import { SchemePromotion } from '../../domain/entities/scheme_promotion.js';
import { SchemePromotionPgRepository } from '../../infrastructure/database/repositories/scheme_promotion.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetSchemePromotionUseCase {
  constructor(private promoRepo: SchemePromotionPgRepository) {}

  async execute(principal: Principal, id: string): Promise<SchemePromotion | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'scheme_promotion:read') && !RbacGuard.can(principal, 'scheme_promotions:read')) {
      throw new Error('Forbidden: Insufficient permissions to read scheme promotion record');
    }

    // 2. Fetch record scoped to tenant
    const promo = await this.promoRepo.findById(principal.tenantId, id);

    // 3. Prevent cross-tenant existence leakage
    if (!promo || promo.tenantId !== principal.tenantId) {
      return null;
    }

    return promo;
  }
}
