import { PurchaseOrder } from '../../../domain/entities/purchase_order.js';
import { PurchaseOrderPgRepository } from '../../../infrastructure/database/repositories/purchase_order.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreatePurchaseOrderDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreatePurchaseOrderUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, PurchaseOrder>();

  constructor(private poRepo: PurchaseOrderPgRepository) {}

  async execute(
    principal: Principal,
    dto: CreatePurchaseOrderDTO,
    idempotencyKey?: string
  ): Promise<PurchaseOrder> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'purchase_order:create')) {
      throw new Error('Forbidden: Insufficient permissions to create purchase order');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreatePurchaseOrderUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check poNumber per tenant
    const existing = await this.poRepo.findByPoNumber(principal.tenantId, dto.poNumber);
    if (existing) {
      throw new Error(`409 Conflict: Purchase order with number ${dto.poNumber} already exists`);
    }

    // 4. Construct aggregate
    const poId = randomUUID();
    const po = PurchaseOrder.create({
      id: poId,
      tenantId: principal.tenantId,
      poNumber: dto.poNumber,
      supplierId: dto.supplierId,
      warehouseId: dto.warehouseId,
      totalAmountCents: dto.totalAmountCents,
    });

    // 5. Persist to repository
    await this.poRepo.save(po);

    // 6. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'distributor.purchase_order.created',
      'v1',
      {
        poId: po.id,
        poNumber: po.poNumber,
        supplierId: po.supplierId,
        warehouseId: po.warehouseId,
        totalAmountCents: po.totalAmountCents,
        status: po.status,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'dms-core-service',
        partitionKey: po.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: po.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'PurchaseOrder',
        po.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreatePurchaseOrderUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, po);
    }

    return po;
  }
}
