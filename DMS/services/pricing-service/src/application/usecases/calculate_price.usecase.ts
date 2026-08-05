import { StructuredLogger } from '@dms/pkg-logger';
import { PricingAggregate, CalculationResult } from '../../domain/aggregates/pricing.aggregate.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { IPriceListRepository } from '../../domain/repositories/price-list.repository.js';
import { PriceListPgRepository } from '../../infrastructure/database/repositories/price-list.pg-repository.js';
import { z } from 'zod';

export const CalculatePriceInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  customerId: z.string().optional(),
  channel: z.string().optional(),
  asOfDate: z.coerce.date().optional(),
});

export type CalculatePriceInput = z.infer<typeof CalculatePriceInputSchema>;

export class CalculatePriceUseCase {
  private logger = new StructuredLogger('CalculatePriceUseCase');

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly priceListRepo?: IPriceListRepository,
  ) {}

  async execute(tenantId: string, input: CalculatePriceInput): Promise<CalculationResult & { priceListId: string }> {
    this.logger.info('Calculating price for product', { productId: input.productId, quantity: input.quantity });

    const parsed = CalculatePriceInputSchema.parse(input);
    const dbClient = this.db;
    const repo = this.priceListRepo || (dbClient ? new PriceListPgRepository(dbClient) : null);

    if (!repo) {
      throw new Error('Repository or database client must be provided');
    }

    // 1. Resolve the active/effective price list based on context
    const priceList = await repo.findEffectivePriceList(
      tenantId,
      parsed.customerId,
      parsed.channel,
      parsed.asOfDate
    );

    if (!priceList) {
      throw new Error(`No active price list found for tenant ${tenantId} and context: customer=${parsed.customerId || 'none'}, channel=${parsed.channel || 'none'}`);
    }

    const entry = priceList.entries?.find(e => e.productId === parsed.productId);
    if (!entry) {
      throw new Error(`Product ${parsed.productId} has no price entry in resolved price list ${priceList.id} (${priceList.name})`);
    }

    // 2. Fetch tax rate
    const taxRule = await repo.findTaxRule(tenantId, entry.taxRuleKey);
    const taxRatePercentage = taxRule ? taxRule.ratePercentage : 18.0;

    // 3. Compute price using PricingAggregate
    const aggregate = new PricingAggregate(priceList);
    const calculation = aggregate.calculatePrice(
      parsed.productId,
      parsed.quantity,
      taxRatePercentage,
      entry.roundingRule
    );

    return {
      ...calculation,
      priceListId: priceList.id,
    };
  }
}
