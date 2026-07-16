import { StructuredLogger } from '@dms/pkg-logger';
import { SchemeEntity } from '../../domain/entities/scheme.entity.js';
import { SchemeAggregate, OrderItemInput, SchemeEvaluationResult } from '../../domain/aggregates/scheme.aggregate.js';
import { ISchemeRepository } from '../../domain/repositories/scheme.repository.js';
import { SchemePgRepository } from '../../infrastructure/database/repositories/scheme.pg-repository.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { z } from 'zod';

export const EvaluateSchemesInputSchema = z.object({
  items: z.array(z.object({
    skuId: z.string().uuid(),
    quantity: z.number().int().positive(),
    price: z.number().int().nonnegative(), // Paire/cents
  })).min(1, 'At least one order item is required'),
  evaluationDate: z.coerce.date().optional(),
});

export type EvaluateSchemesInput = z.infer<typeof EvaluateSchemesInputSchema>;

export interface AppliedSchemeResult {
  schemeId: string;
  schemeName: string;
  discountPercentage: number;
  flatDiscount: number;
  freeGoods: { skuId: string; quantity: number }[];
  monetaryBenefit: number;
}

export interface EvaluateSchemesResult {
  appliedSchemes: AppliedSchemeResult[];
  totalDiscount: number;
  freeGoods: { skuId: string; quantity: number }[];
}

export class EvaluateSchemesUseCase {
  private logger = new StructuredLogger('EvaluateSchemesUseCase');

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly schemeRepo?: ISchemeRepository
  ) {}

  async execute(tenantId: string, input: EvaluateSchemesInput): Promise<EvaluateSchemesResult> {
    this.logger.info('Evaluating trade schemes', { itemCount: input.items.length });

    // Validate Input
    const parsed = EvaluateSchemesInputSchema.parse(input);
    const evaluationDate = parsed.evaluationDate || new Date();

    if (!this.db) {
      throw new Error('Database client not configured');
    }

    const repo = this.schemeRepo || new SchemePgRepository(this.db);

    // 1. Fetch all active schemes for this tenant. 
    // We pass page=1 and pageSize=1000 to get all of them.
    const paginated = await repo.findAll(tenantId, {
      page: 1,
      pageSize: 1000,
      where: { status: 'active' },
    });

    const activeSchemes = paginated.data;

    // 2. Evaluate eligibility and benefit for each active scheme
    const eligibleResults: SchemeEvaluationResult[] = [];
    for (const scheme of activeSchemes) {
      const aggregate = new SchemeAggregate(scheme);
      const res = aggregate.evaluate(parsed.items, evaluationDate);
      if (res.isEligible) {
        eligibleResults.push(res);
      }
    }

    // 3. Sort eligible schemes by total monetary benefit descending
    eligibleResults.sort((a, b) => b.totalMonetaryBenefit - a.totalMonetaryBenefit);

    // 4. Resolve stacking / mutual exclusion rules
    const appliedResults: SchemeEvaluationResult[] = [];
    const appliedExclusionGroups = new Set<string>();

    for (const res of eligibleResults) {
      if (!res.allowStacking) {
        // If not stackable, verify that no other scheme from the same exclusion group was already applied
        if (appliedExclusionGroups.has(res.exclusionGroup)) {
          continue;
        }
        appliedResults.push(res);
        appliedExclusionGroups.add(res.exclusionGroup);
      } else {
        // Stackable scheme is applied
        appliedResults.push(res);
        // Note: we can optionally record exclusionGroup if we want stackables to block non-stackables of the same group
        appliedExclusionGroups.add(res.exclusionGroup);
      }
    }

    // 5. Build final response, aggregating discounts and free goods
    const totalOrderAmount = parsed.items.reduce((sum, item) => sum + item.quantity * item.price, 0);

    const appliedSchemesList: AppliedSchemeResult[] = [];
    let totalDiscount = 0;
    const aggregatedFreeGoodsMap = new Map<string, number>();

    for (const res of appliedResults) {
      // Re-calculate the actual discount value for this scheme on the current items
      const targetScheme = activeSchemes.find(s => s.id === res.schemeId);
      if (!targetScheme) continue;

      const matchingItemsValue = targetScheme.rules.applicableSkuIds && targetScheme.rules.applicableSkuIds.length > 0
        ? parsed.items.filter(item => targetScheme.rules.applicableSkuIds!.includes(item.skuId)).reduce((sum, item) => sum + item.quantity * item.price, 0)
        : totalOrderAmount;

      const percentageDiscountAmount = Math.round(matchingItemsValue * (res.appliedDiscountPercentage / 100));
      const schemeDiscountTotal = percentageDiscountAmount + res.appliedFlatDiscount;

      totalDiscount += schemeDiscountTotal;

      // Aggregate free goods
      for (const fg of res.appliedFreeGoods) {
        const cur = aggregatedFreeGoodsMap.get(fg.skuId) || 0;
        aggregatedFreeGoodsMap.set(fg.skuId, cur + fg.quantity);
      }

      appliedSchemesList.push({
        schemeId: res.schemeId,
        schemeName: res.schemeName,
        discountPercentage: res.appliedDiscountPercentage,
        flatDiscount: res.appliedFlatDiscount,
        freeGoods: res.appliedFreeGoods,
        monetaryBenefit: res.totalMonetaryBenefit,
      });
    }

    const freeGoodsList = Array.from(aggregatedFreeGoodsMap.entries()).map(([skuId, quantity]) => ({
      skuId,
      quantity,
    }));

    return {
      appliedSchemes: appliedSchemesList,
      totalDiscount,
      freeGoods: freeGoodsList,
    };
  }
}
