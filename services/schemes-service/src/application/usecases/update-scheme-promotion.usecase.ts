import { SchemePromotion } from '../../domain/entities/scheme_promotion.js';
import { SchemePromotionPgRepository } from '../../infrastructure/database/repositories/scheme_promotion.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { UpdateSchemePromotionDTO } from '@dms/pkg-validation';

export class UpdateSchemePromotionUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(private promoRepo: SchemePromotionPgRepository) {}

  async execute(
    principal: Principal,
    id: string,
    dto: UpdateSchemePromotionDTO
  ): Promise<SchemePromotion> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'scheme_promotion:update')) {
      throw new Error('Forbidden: Insufficient permissions to update scheme promotion');
    }

    // 2. Fetch existing entity
    const existing = await this.promoRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`SchemePromotion with ID ${id} not found`);
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
    await this.promoRepo.save(existing);

    // 6. Record outbox event
    const eventEnvelope = makeEnvelope(
      'schemes.scheme_promotion.status_updated',
      'v1',
      {
        promoId: existing.id,
        promoCode: existing.promoCode,
        status: existing.status,
        version: existing.version,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'schemes-service',
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
        'SchemePromotion',
        existing.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    return existing;
  }
}
