import { PriceSlab } from '../../domain/entities/price_slab.js';
import { PriceSlabPgRepository } from '../../infrastructure/database/repositories/price_slab.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreatePriceSlabDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreatePriceSlabUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, PriceSlab>();

  constructor(private slabRepo: PriceSlabPgRepository) {}

  async execute(
    principal: Principal,
    dto: CreatePriceSlabDTO,
    idempotencyKey?: string
  ): Promise<PriceSlab> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'price_slab:create')) {
      throw new Error('Forbidden: Insufficient permissions to create price slab');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreatePriceSlabUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Construct aggregate
    const slabId = randomUUID();
    const slab = PriceSlab.create({
      id: slabId,
      tenantId: principal.tenantId,
      priceListId: dto.priceListId,
      skuId: dto.skuId,
      minQuantity: dto.minQuantity,
      maxQuantity: dto.maxQuantity,
      priceCents: dto.priceCents,
    });

    // 4. Persist to repository
    await this.slabRepo.save(slab);

    // 5. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'pricing.price_slab.created',
      'v1',
      {
        slabId: slab.id,
        priceListId: slab.priceListId,
        skuId: slab.skuId,
        minQuantity: slab.minQuantity,
        maxQuantity: slab.maxQuantity,
        priceCents: slab.priceCents,
        status: slab.status,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'pricing-service',
        partitionKey: slab.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: slab.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'PriceSlab',
        slab.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreatePriceSlabUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, slab);
    }

    return slab;
  }
}
