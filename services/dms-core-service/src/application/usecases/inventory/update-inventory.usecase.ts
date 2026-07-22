import { Inventory } from '../../../domain/entities/inventory.js';
import { InventoryPgRepository } from '../../../infrastructure/database/repositories/inventory.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { UpdateInventoryDTO } from '@dms/pkg-validation';

export class UpdateInventoryUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(private inventoryRepo: InventoryPgRepository) {}

  async execute(
    principal: Principal,
    id: string,
    dto: UpdateInventoryDTO
  ): Promise<Inventory> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'inventory:update')) {
      throw new Error('Forbidden: Insufficient permissions to update inventory');
    }

    // 2. Fetch existing entity
    const existing = await this.inventoryRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`Inventory with ID ${id} not found`);
    }

    // 3. Optimistic locking check
    if (dto.version !== undefined && existing.version !== dto.version) {
      throw new Error('409 Conflict: Optimistic locking failure, version mismatch');
    }

    // 4. Apply domain updates
    if (dto.quantityAvailable !== undefined) {
      const delta = dto.quantityAvailable - existing.quantityAvailable;
      existing.adjustStock(delta);
    }
    if (dto.quantityReserved !== undefined) {
      if (dto.quantityReserved > existing.quantityReserved) {
        existing.reserveStock(dto.quantityReserved - existing.quantityReserved);
      }
    }

    // 5. Persist updated aggregate
    await this.inventoryRepo.save(existing);

    // 6. Record outbox event
    const eventEnvelope = makeEnvelope(
      'distributor.inventory.adjusted',
      'v1',
      {
        inventoryId: existing.id,
        warehouseId: existing.warehouseId,
        skuId: existing.skuId,
        quantityAvailable: existing.quantityAvailable,
        quantityReserved: existing.quantityReserved,
        status: existing.status,
        version: existing.version,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'dms-core-service',
        partitionKey: existing.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: existing.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'Inventory',
        existing.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    return existing;
  }
}
