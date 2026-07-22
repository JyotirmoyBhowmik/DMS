import { TaxRule } from '../../domain/entities/tax_rule.js';
import { TaxRulePgRepository } from '../../infrastructure/database/repositories/tax_rule.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetTaxRuleUseCase {
  constructor(private ruleRepo: TaxRulePgRepository) {}

  async execute(principal: Principal, id: string): Promise<TaxRule | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'tax_rule:read') && !RbacGuard.can(principal, 'tax_rules:read')) {
      throw new Error('Forbidden: Insufficient permissions to read tax rule record');
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
