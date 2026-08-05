import { Sku } from '../../../domain/entities/sku.js';
import { SkuPgRepository } from '../../../infrastructure/database/repositories/sku.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreateSkuDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreateSkuUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, Sku>();

  constructor(private skuRepo: SkuPgRepository) {}

  async execute(
    principal: Principal,
    dto: CreateSkuDTO,
    idempotencyKey?: string
  ): Promise<Sku> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'sku:create')) {
      throw new Error('Forbidden: Insufficient permissions to create SKU');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreateSkuUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check SKU Code per tenant
    const existing = await this.skuRepo.findByCode(principal.tenantId, dto.code);
    if (existing) {
      throw new Error(`409 Conflict: SKU Code ${dto.code} already exists`);
    }

    // 4. Construct aggregate
    const skuId = randomUUID();
    const skuItem = Sku.create({
      id: skuId,
      tenantId: principal.tenantId,
      code: dto.code,
      name: dto.name,
      productId: dto.productId,
      barcode: dto.barcode,
      ean: dto.ean,
      unitPrice: dto.unitPrice ?? 0,
    });

    // 5. Persist to repository
    await this.skuRepo.save(skuItem);

    // 6. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'distributor.sku.created',
      'v1',
      {
        skuId: skuItem.id,
        code: skuItem.code,
        name: skuItem.name,
        unitPrice: skuItem.unitPrice,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'dms-core-service',
        partitionKey: skuItem.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: skuItem.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'Sku',
        skuItem.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreateSkuUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, skuItem);
    }

    return skuItem;
  }
}
