import { ChannelPriceRule } from '../../domain/entities/channel_price_rule.js';
import { ChannelPriceRulePgRepository } from '../../infrastructure/database/repositories/channel_price_rule.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetChannelPriceRuleUseCase {
  constructor(private ruleRepo: ChannelPriceRulePgRepository) {}

  async execute(principal: Principal, id: string): Promise<ChannelPriceRule | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'channel_price_rule:read') && !RbacGuard.can(principal, 'channel_price_rules:read')) {
      throw new Error('Forbidden: Insufficient permissions to read channel price rule record');
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
