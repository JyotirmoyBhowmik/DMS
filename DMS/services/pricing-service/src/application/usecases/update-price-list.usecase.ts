import { PriceList } from '../../domain/entities/price_list.js';
import { PriceListPgRepository } from '../../infrastructure/database/repositories/price_list.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { UpdatePriceListDTO } from '@dms/pkg-validation';

export class UpdatePriceListUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(private listRepo: PriceListPgRepository) {}

  async execute(
    principal: Principal,
    id: string,
    dto: UpdatePriceListDTO
  ): Promise<PriceList> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'price_list:update')) {
      throw new Error('Forbidden: Insufficient permissions to update price list');
    }

    // 2. Fetch existing entity
    const existing = await this.listRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`PriceList with ID ${id} not found`);
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
    await this.listRepo.save(existing);

    // 6. Record outbox event
    const eventEnvelope = makeEnvelope(
      'pricing.price_list.status_updated',
      'v1',
      {
        listId: existing.id,
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
        'PriceList',
        existing.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    return existing;
  }
}
