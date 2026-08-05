import { Product } from '../../../domain/entities/product.js';
import { ProductPgRepository } from '../../../infrastructure/database/repositories/product.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { UpdateProductDTO } from '@dms/pkg-validation';

export class UpdateProductUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(private productRepo: ProductPgRepository) {}

  async execute(
    principal: Principal,
    id: string,
    dto: UpdateProductDTO
  ): Promise<Product> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'product:update')) {
      throw new Error('Forbidden: Insufficient permissions to update product');
    }

    // 2. Fetch existing entity
    const existing = await this.productRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`Product with ID ${id} not found`);
    }

    // 3. Optimistic locking check
    if (dto.version !== undefined && existing.version !== dto.version) {
      throw new Error('409 Conflict: Optimistic locking failure, version mismatch');
    }

    // 4. Apply domain updates
    existing.updateDetails({
      name: dto.name,
      category: dto.category,
      price: dto.price,
      minThreshold: dto.minThreshold,
      uom: dto.uom,
      status: dto.status as any,
    });

    // 5. Persist updated aggregate
    await this.productRepo.save(existing);

    // 6. Record outbox event
    const eventEnvelope = makeEnvelope(
      'distributor.product.updated',
      'v1',
      {
        productId: existing.id,
        sku: existing.sku,
        name: existing.name,
        price: existing.price,
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
        'Product',
        existing.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    return existing;
  }
}
