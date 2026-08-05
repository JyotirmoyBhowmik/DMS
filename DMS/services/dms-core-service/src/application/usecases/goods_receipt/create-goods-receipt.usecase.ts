import { GoodsReceipt } from '../../../domain/entities/goods_receipt.js';
import { GoodsReceiptPgRepository } from '../../../infrastructure/database/repositories/goods_receipt.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreateGoodsReceiptDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreateGoodsReceiptUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, GoodsReceipt>();

  constructor(private grRepo: GoodsReceiptPgRepository) {}

  async execute(
    principal: Principal,
    dto: CreateGoodsReceiptDTO,
    idempotencyKey?: string
  ): Promise<GoodsReceipt> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'goods_receipt:create')) {
      throw new Error('Forbidden: Insufficient permissions to create goods receipt');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreateGoodsReceiptUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check receiptNumber per tenant
    const existing = await this.grRepo.findByReceiptNumber(principal.tenantId, dto.receiptNumber);
    if (existing) {
      throw new Error(`409 Conflict: Goods receipt with number ${dto.receiptNumber} already exists`);
    }

    // 4. Construct aggregate
    const grId = randomUUID();
    const gr = GoodsReceipt.create({
      id: grId,
      tenantId: principal.tenantId,
      receiptNumber: dto.receiptNumber,
      purchaseOrderId: dto.purchaseOrderId,
      warehouseId: dto.warehouseId,
      skuId: dto.skuId,
      receivedQuantity: dto.receivedQuantity,
    });

    // 5. Persist to repository
    await this.grRepo.save(gr);

    // 6. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'distributor.goods_receipt.created',
      'v1',
      {
        grId: gr.id,
        receiptNumber: gr.receiptNumber,
        purchaseOrderId: gr.purchaseOrderId,
        warehouseId: gr.warehouseId,
        skuId: gr.skuId,
        receivedQuantity: gr.receivedQuantity,
        status: gr.status,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'dms-core-service',
        partitionKey: gr.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: gr.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'GoodsReceipt',
        gr.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreateGoodsReceiptUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, gr);
    }

    return gr;
  }
}
