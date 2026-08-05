import { Inventory } from '../../../domain/entities/inventory.js';
import { InventoryPgRepository } from '../../../infrastructure/database/repositories/inventory.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreateInventoryDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreateInventoryUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, Inventory>();

  constructor(private inventoryRepo: InventoryPgRepository) {}

  async execute(
    principal: Principal,
    dto: CreateInventoryDTO,
    idempotencyKey?: string
  ): Promise<Inventory> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'inventory:create')) {
      throw new Error('Forbidden: Insufficient permissions to create inventory entry');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreateInventoryUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check (warehouseId, skuId) per tenant
    const existing = await this.inventoryRepo.findByWarehouseAndSku(principal.tenantId, dto.warehouseId, dto.skuId);
    if (existing) {
      throw new Error(`409 Conflict: Inventory record for warehouse ${dto.warehouseId} and SKU ${dto.skuId} already exists`);
    }

    // 4. Construct aggregate
    const invId = randomUUID();
    const inv = Inventory.create({
      id: invId,
      tenantId: principal.tenantId,
      warehouseId: dto.warehouseId,
      skuId: dto.skuId,
      quantityAvailable: dto.quantityAvailable ?? 0,
      quantityReserved: dto.quantityReserved ?? 0,
      reorderLevel: dto.reorderLevel ?? 10,
    });

    // 5. Persist to repository
    await this.inventoryRepo.save(inv);

    // 6. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'distributor.inventory.adjusted',
      'v1',
      {
        inventoryId: inv.id,
        warehouseId: inv.warehouseId,
        skuId: inv.skuId,
        quantityAvailable: inv.quantityAvailable,
        status: inv.status,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'dms-core-service',
        partitionKey: inv.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: inv.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'Inventory',
        inv.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreateInventoryUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, inv);
    }

    return inv;
  }
}
