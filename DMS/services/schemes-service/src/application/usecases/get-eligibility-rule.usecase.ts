import { EligibilityRule } from '../../domain/entities/eligibility_rule.js';
import { EligibilityRulePgRepository } from '../../infrastructure/database/repositories/eligibility_rule.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetEligibilityRuleUseCase {
  constructor(private ruleRepo: EligibilityRulePgRepository) {}

  async execute(principal: Principal, id: string): Promise<EligibilityRule | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'eligibility_rule:read') && !RbacGuard.can(principal, 'eligibility_rules:read')) {
      throw new Error('Forbidden: Insufficient permissions to read eligibility rule record');
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
