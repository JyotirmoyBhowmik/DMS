import { Discount } from '../../domain/entities/discount.js';
import { DiscountPgRepository } from '../../infrastructure/database/repositories/discount.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { UpdateDiscountDTO } from '@dms/pkg-validation';

export class UpdateDiscountUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(private discountRepo: DiscountPgRepository) {}

  async execute(
    principal: Principal,
    id: string,
    dto: UpdateDiscountDTO
  ): Promise<Discount> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'discount:update')) {
      throw new Error('Forbidden: Insufficient permissions to update discount');
    }

    // 2. Fetch existing entity
    const existing = await this.discountRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`Discount with ID ${id} not found`);
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
    await this.discountRepo.save(existing);

    // 6. Record outbox event
    const eventEnvelope = makeEnvelope(
      'pricing.discount.status_updated',
      'v1',
      {
        discountId: existing.id,
        code: existing.code,
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
        'Discount',
        existing.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    return existing;
  }
}
