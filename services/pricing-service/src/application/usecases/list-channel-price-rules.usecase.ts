import { ChannelPriceRule, ChannelPriceRuleStatus, ChannelCode } from '../../domain/entities/channel_price_rule.js';
import { ChannelPriceRulePgRepository } from '../../infrastructure/database/repositories/channel_price_rule.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListChannelPriceRulesQuery {
  status?: ChannelPriceRuleStatus;
  priceListId?: string;
  channelCode?: ChannelCode;
  page?: number;
  pageSize?: number;
}

export interface PaginatedChannelPriceRules {
  data: ChannelPriceRule[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListChannelPriceRulesUseCase {
  constructor(private ruleRepo: ChannelPriceRulePgRepository) {}

  async execute(principal: Principal, query: ListChannelPriceRulesQuery): Promise<PaginatedChannelPriceRules> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'channel_price_rule:read') && !RbacGuard.can(principal, 'channel_price_rules:read')) {
      throw new Error('Forbidden: Insufficient permissions to list channel price rules');
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
    if (query.channelCode) {
      items = items.filter(r => r.channelCode === query.channelCode);
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
