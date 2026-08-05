import { Sku } from '../../../domain/entities/sku.js';
import { SkuPgRepository } from '../../../infrastructure/database/repositories/sku.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { UpdateSkuDTO } from '@dms/pkg-validation';

export class UpdateSkuUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(private skuRepo: SkuPgRepository) {}

  async execute(
    principal: Principal,
    id: string,
    dto: UpdateSkuDTO
  ): Promise<Sku> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'sku:update')) {
      throw new Error('Forbidden: Insufficient permissions to update SKU');
    }

    // 2. Fetch existing entity
    const existing = await this.skuRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`SKU with ID ${id} not found`);
    }

    // 3. Optimistic locking check
    if (dto.version !== undefined && existing.version !== dto.version) {
      throw new Error('409 Conflict: Optimistic locking failure, version mismatch');
    }

    // 4. Apply domain updates
    existing.updateDetails({
      name: dto.name,
      productId: dto.productId,
      barcode: dto.barcode,
      ean: dto.ean,
      unitPrice: dto.unitPrice,
      status: dto.status as any,
    });

    // 5. Persist updated aggregate
    await this.skuRepo.save(existing);

    // 6. Record outbox event
    const eventEnvelope = makeEnvelope(
      'distributor.sku.updated',
      'v1',
      {
        skuId: existing.id,
        code: existing.code,
        name: existing.name,
        unitPrice: existing.unitPrice,
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
        'Sku',
        existing.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    return existing;
  }
}
