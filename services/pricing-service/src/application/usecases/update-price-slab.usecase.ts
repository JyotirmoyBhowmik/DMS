import { PriceSlab } from '../../domain/entities/price_slab.js';
import { PriceSlabPgRepository } from '../../infrastructure/database/repositories/price_slab.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { UpdatePriceSlabDTO } from '@dms/pkg-validation';

export class UpdatePriceSlabUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(private slabRepo: PriceSlabPgRepository) {}

  async execute(
    principal: Principal,
    id: string,
    dto: UpdatePriceSlabDTO
  ): Promise<PriceSlab> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'price_slab:update')) {
      throw new Error('Forbidden: Insufficient permissions to update price slab');
    }

    // 2. Fetch existing entity
    const existing = await this.slabRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`PriceSlab with ID ${id} not found`);
    }

    // 3. Optimistic locking check
    if (dto.version !== undefined && existing.version !== dto.version) {
      throw new Error('409 Conflict: Optimistic locking failure, version mismatch');
    }

    // 4. Apply state transitions
    if (dto.status !== undefined) {
      existing.updateStatus(dto.status);
    }

    // 5. Persist updated aggregate
    await this.slabRepo.save(existing);

    // 6. Record outbox event
    const eventEnvelope = makeEnvelope(
      'pricing.price_slab.status_updated',
      'v1',
      {
        slabId: existing.id,
        status: existing.status,
        version: existing.version,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'pricing-service',
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
        'PriceSlab',
        existing.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    return existing;
  }
}
