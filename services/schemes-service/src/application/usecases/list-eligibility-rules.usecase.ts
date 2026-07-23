import { EligibilityRule, EligibilityRuleStatus, RuleType } from '../../domain/entities/eligibility_rule.js';
import { EligibilityRulePgRepository } from '../../infrastructure/database/repositories/eligibility_rule.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListEligibilityRulesQuery {
  status?: EligibilityRuleStatus;
  schemeId?: string;
  ruleCode?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedEligibilityRules {
  data: EligibilityRule[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListEligibilityRulesUseCase {
  constructor(private ruleRepo: EligibilityRulePgRepository) {}

  async execute(principal: Principal, query: ListEligibilityRulesQuery): Promise<PaginatedEligibilityRules> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'eligibility_rule:read') && !RbacGuard.can(principal, 'eligibility_rules:read')) {
      throw new Error('Forbidden: Insufficient permissions to list eligibility rules');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items = await this.ruleRepo.findAll(principal.tenantId);

    if (query.status) {
      items = items.filter(r => r.status === query.status);
    }
    if (query.schemeId) {
      items = items.filter(r => r.schemeId === query.schemeId);
    }
    if (query.ruleCode) {
      items = items.filter(r => r.ruleCode === query.ruleCode);
    }

    const total = items.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const offset = (page - 1) * pageSize;
    const paginatedData = items.slice(offset, offset + pageSize);

    return {
      data: paginatedData,
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}
