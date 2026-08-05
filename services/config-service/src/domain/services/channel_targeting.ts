import { FeatureFlagAggregate } from '../entities/feature_flag.entity.js';

export type ChannelType = 'MART' | 'HOTEL_RESTAURANT' | 'SMALL_SHOP' | 'VAN_OPERATOR' | 'SALES_MARKETING_INTERNAL';

export interface ChannelModuleConfig {
  channelType: ChannelType;
  enabledModules: string[];
  customFlags: Record<string, boolean>;
}

export class ChannelTargetingService {
  private static DEFAULT_CHANNEL_MODULES: Record<ChannelType, string[]> = {
    MART: ['DMS_CORE', 'BULK_ORDERING', 'BARCODE_SCANNER', 'MERCHANDISING_AUDIT', 'ANALYTICS'],
    HOTEL_RESTAURANT: ['DMS_CORE', 'CONTRACT_PRICING', 'RECURRING_BILLING', 'CREDIT_NOTES'],
    SMALL_SHOP: ['DMS_CORE', 'SFA', 'QUICK_ORDER', 'CASH_COLLECTION', 'TRADE_SCHEMES'],
    VAN_OPERATOR: ['DMS_CORE', 'VAN_SALES', 'SPOT_INVOICING', 'THERMAL_PRINTING', 'VAN_STOCK_LOAD'],
    SALES_MARKETING_INTERNAL: ['DMS_CORE', 'SAMPLE_DISTRIBUTION', 'PROMO_AUDIT', 'TERRITORY_INSIGHTS'],
  };

  /**
   * Evaluates feature flags for a given channel type context.
   */
  public evaluateChannelModules(
    channelType: ChannelType,
    flags: FeatureFlagAggregate[],
    tenantId: string
  ): ChannelModuleConfig {
    const baseModules = ChannelTargetingService.DEFAULT_CHANNEL_MODULES[channelType] || ['DMS_CORE', 'SFA'];
    const customFlags: Record<string, boolean> = {};

    for (const flag of flags) {
      const isTargeted = flag.evaluate({
        attributes: { channelType, tenantId },
      });
      customFlags[flag.flagKey] = isTargeted;
    }

    return {
      channelType,
      enabledModules: baseModules,
      customFlags,
    };
  }
}
