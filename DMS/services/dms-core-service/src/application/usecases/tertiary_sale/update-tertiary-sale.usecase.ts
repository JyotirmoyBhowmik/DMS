import { TertiarySale } from '../../../domain/entities/tertiary_sale.js';
import { TertiarySalePgRepository } from '../../../infrastructure/database/repositories/tertiary_sale.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { UpdateTertiarySaleDTO } from '@dms/pkg-validation';

export class UpdateTertiarySaleUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(private saleRepo: TertiarySalePgRepository) {}

  async execute(
    principal: Principal,
    id: string,
    dto: UpdateTertiarySaleDTO
  ): Promise<TertiarySale> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'tertiary_sale:update')) {
      throw new Error('Forbidden: Insufficient permissions to update tertiary sale');
    }

    // 2. Fetch existing entity
    const existing = await this.saleRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`TertiarySale with ID ${id} not found`);
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
    await this.saleRepo.save(existing);

    // 6. Record outbox event
    const eventEnvelope = makeEnvelope(
      'distributor.tertiary_sale.status_updated',
      'v1',
      {
        saleId: existing.id,
        invoiceNumber: existing.invoiceNumber,
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
        'TertiarySale',
        existing.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    return existing;
  }
}
