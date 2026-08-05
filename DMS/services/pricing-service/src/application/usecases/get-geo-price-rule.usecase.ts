import { GeoPriceRule } from '../../domain/entities/geo_price_rule.js';
import { GeoPriceRulePgRepository } from '../../infrastructure/database/repositories/geo_price_rule.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetGeoPriceRuleUseCase {
  constructor(private ruleRepo: GeoPriceRulePgRepository) {}

  async execute(principal: Principal, id: string): Promise<GeoPriceRule | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'geo_price_rule:read') && !RbacGuard.can(principal, 'geo_price_rules:read')) {
      throw new Error('Forbidden: Insufficient permissions to read geo price rule record');
    }

    // 2. Fetch record scoped to tenant
    const rule = await this.ruleRepo.findById(principal.tenantId, id);

    // 3. Prevent cross-tenant existence leakage
    if (!rule || rule.tenantId !== principal.tenantId) {
      return null;
    }

    return rule;
  }
}
