import { randomUUID } from 'node:crypto';
import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { PriceListEntryEntity } from '../../domain/entities/price-list-entry.entity.js';
import { PricingAggregate } from '../../domain/aggregates/pricing.aggregate.js';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { IPriceListRepository } from '../../domain/repositories/price-list.repository.js';
import { PriceListPgRepository } from '../../infrastructure/database/repositories/price-list.pg-repository.js';
import { TransactionalDbClient } from '../../infrastructure/database/transactional-client.js';
import { z } from 'zod';

export const AddPriceListEntryInputSchema = z.object({
  productId: z.string().uuid(),
  basePrice: z.union([z.number(), z.string(), z.bigint()]),
  mrp: z.union([z.number(), z.string(), z.bigint()]),
  taxRuleKey: z.string().default('GST_18'),
  roundingRule: z.string().default('HALF_UP'),
  tiers: z.array(z.object({
    id: z.string().uuid().optional(),
    minQuantity: z.number().int().positive(),
    discountPercentage: z.number().min(0).max(100).optional(),
    discountFlat: z.union([z.number(), z.string(), z.bigint()]).optional(),
  })).default([]),
  actorId: z.string(),
  reason: z.string().optional(),
});

export type AddPriceListEntryInput = z.input<typeof AddPriceListEntryInputSchema>;


export class AddPriceListEntryUseCase {
  private logger = new StructuredLogger('AddPriceListEntryUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'pricing_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly priceListRepo?: IPriceListRepository,
  ) {}

  async execute(tenantId: string, priceListId: string, input: AddPriceListEntryInput): Promise<PriceListEntryEntity> {
    this.logger.info('Adding price list entry', { priceListId, productId: input.productId });

    const parsed = AddPriceListEntryInputSchema.parse(input);

    let savedEntry: PriceListEntryEntity;

    if (this.db) {
      await this.db.transaction(async (conn) => {
        const txDb = new TransactionalDbClient(conn);
        const repo = this.priceListRepo || new PriceListPgRepository(txDb);

        // Verify PriceList exists
        const priceList = await repo.findById(priceListId, tenantId);

        // Check if entry already exists to capture old values for audit trail
        const existingEntries = await repo.findEntriesForPriceList(priceListId, tenantId);
        const existingEntry = existingEntries.find(e => e.productId === parsed.productId);

        const oldBasePrice = existingEntry?.basePrice;
        const oldMrp = existingEntry?.mrp;

        const entryId = existingEntry?.id || randomUUID();
        const entry = new PriceListEntryEntity({
          id: entryId,
          priceListId,
          productId: parsed.productId,
          basePrice: BigInt(parsed.basePrice.toString()),
          mrp: BigInt(parsed.mrp.toString()),
          taxRuleKey: parsed.taxRuleKey,
          roundingRule: parsed.roundingRule,
          tiers: parsed.tiers.map(t => ({
            id: t.id || randomUUID(),
            entryId,
            minQuantity: t.minQuantity,
            discountPercentage: t.discountPercentage,
            discountFlat: t.discountFlat !== undefined ? BigInt(t.discountFlat.toString()) : undefined,
          })),
        });

        // Temporary pricing aggregate to validate entry invariants
        const testPriceList = { ...priceList, entries: [entry] };
        new PricingAggregate(testPriceList).validateInvariants();

        // Save entry (this handles deleting old tiers and writing new ones)
        savedEntry = await repo.saveEntry(entry, tenantId);

        // Log Audit Trail
        const actionType = existingEntry ? 'UPDATE_ENTRY' : 'CREATE_ENTRY';
        await repo.saveAuditLog({
          priceListId,
          productId: entry.productId,
          actorId: parsed.actorId,
          actionType,
          oldBasePrice,
          newBasePrice: entry.basePrice,
          oldMrp,
          newMrp: entry.mrp,
          reason: parsed.reason,
        }, tenantId);

        // Publish event if price changed
        const priceChanged = !existingEntry || oldBasePrice !== entry.basePrice || oldMrp !== entry.mrp;
        if (priceChanged) {
          const activeCtx = getCorrelation();
          const event = makeEnvelope(
            'price.changed',
            'v1',
            {
              priceListId,
              productId: entry.productId,
              basePrice: entry.basePrice.toString(),
              mrp: entry.mrp.toString(),
              oldBasePrice: oldBasePrice?.toString() ?? null,
              oldMrp: oldMrp?.toString() ?? null,
              actorId: parsed.actorId,
            },
            {
              tenantId,
              correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
              producer: 'pricing-service',
              partitionKey: productIdKey(priceListId, entry.productId),
              causationId: activeCtx?.causationId,
            }
          );

          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'PriceEntry', entry.id);
        }
      }, tenantId);
    } else if (this.priceListRepo) {
      const repo = this.priceListRepo;
      const priceList = await repo.findById(priceListId, tenantId);
      const existingEntries = await repo.findEntriesForPriceList(priceListId, tenantId);
      const existingEntry = existingEntries.find(e => e.productId === parsed.productId);

      const oldBasePrice = existingEntry?.basePrice;
      const oldMrp = existingEntry?.mrp;

      const entryId = existingEntry?.id || randomUUID();
      const entry = new PriceListEntryEntity({
        id: entryId,
        priceListId,
        productId: parsed.productId,
        basePrice: BigInt(parsed.basePrice.toString()),
        mrp: BigInt(parsed.mrp.toString()),
        taxRuleKey: parsed.taxRuleKey,
        roundingRule: parsed.roundingRule,
        tiers: parsed.tiers.map(t => ({
          id: t.id || randomUUID(),
          entryId,
          minQuantity: t.minQuantity,
          discountPercentage: t.discountPercentage,
          discountFlat: t.discountFlat !== undefined ? BigInt(t.discountFlat.toString()) : undefined,
        })),
      });

      const testPriceList = { ...priceList, entries: [entry] };
      new PricingAggregate(testPriceList).validateInvariants();

      savedEntry = await repo.saveEntry(entry, tenantId);

      const actionType = existingEntry ? 'UPDATE_ENTRY' : 'CREATE_ENTRY';
      await repo.saveAuditLog({
        priceListId,
        productId: entry.productId,
        actorId: parsed.actorId,
        actionType,
        oldBasePrice,
        newBasePrice: entry.basePrice,
        oldMrp,
        newMrp: entry.mrp,
        reason: parsed.reason,
      }, tenantId);
    } else {
      throw new Error('Database client or Repository not configured');
    }

    return savedEntry!;
  }
}

function productIdKey(priceListId: string, productId: string): string {
  return `${priceListId}:${productId}`;
}
