import { InventoryPgRepository } from '../database/repositories/inventory.pg-repository.js';
import { StructuredLogger } from '@dms/pkg-logger';

export class InventoryEventConsumer {
  private logger = new StructuredLogger('InventoryEventConsumer');

  constructor(private inventoryRepo: InventoryPgRepository) {}

  async processEvent(envelope: any): Promise<void> {
    this.logger.info('Inbound inventory event received for projection', {
      eventId: envelope.eventId,
      type: envelope.type,
      tenantId: envelope.tenantId,
    });

    if (envelope.type === 'distributor.inventory.adjusted') {
      const { warehouseId, skuId, quantityAvailable } = envelope.payload;
      const existing = await this.inventoryRepo.findByWarehouseAndSku(envelope.tenantId, warehouseId, skuId);
      if (existing) {
        const delta = quantityAvailable - existing.quantityAvailable;
        if (delta !== 0) {
          existing.adjustStock(delta);
          await this.inventoryRepo.save(existing);
        }
      }
    }
  }
}
