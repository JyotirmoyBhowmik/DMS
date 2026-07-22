import { TaxRule, TaxRuleStatus, TaxCode } from '../../domain/entities/tax_rule.js';
import { TaxRulePgRepository } from '../../infrastructure/database/repositories/tax_rule.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListTaxRulesQuery {
  status?: TaxRuleStatus;
  taxCode?: TaxCode;
  page?: number;
  pageSize?: number;
}

export interface PaginatedTaxRules {
  data: TaxRule[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListTaxRulesUseCase {
  constructor(private ruleRepo: TaxRulePgRepository) {}

  async execute(principal: Principal, query: ListTaxRulesQuery): Promise<PaginatedTaxRules> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'tax_rule:read') && !RbacGuard.can(principal, 'tax_rules:read')) {
      throw new Error('Forbidden: Insufficient permissions to list tax rules');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items = await this.ruleRepo.findAll(principal.tenantId);

    if (query.status) {
      items = items.filter(r => r.status === query.status);
    }
    if (query.taxCode) {
      items = items.filter(r => r.taxCode === query.taxCode);
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
