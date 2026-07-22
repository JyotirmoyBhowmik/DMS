import { GeoPriceRule, GeoPriceRuleStatus } from '../../domain/entities/geo_price_rule.js';
import { GeoPriceRulePgRepository } from '../../infrastructure/database/repositories/geo_price_rule.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListGeoPriceRulesQuery {
  status?: GeoPriceRuleStatus;
  priceListId?: string;
  regionCode?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedGeoPriceRules {
  data: GeoPriceRule[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListGeoPriceRulesUseCase {
  constructor(private ruleRepo: GeoPriceRulePgRepository) {}

  async execute(principal: Principal, query: ListGeoPriceRulesQuery): Promise<PaginatedGeoPriceRules> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'geo_price_rule:read') && !RbacGuard.can(principal, 'geo_price_rules:read')) {
      throw new Error('Forbidden: Insufficient permissions to list geo price rules');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items = await this.ruleRepo.findAll(principal.tenantId);

    if (query.status) {
      items = items.filter(r => r.status === query.status);
    }
    if (query.priceListId) {
      items = items.filter(r => r.priceListId === query.priceListId);
    }
    if (query.regionCode) {
      items = items.filter(r => r.regionCode === query.regionCode);
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
