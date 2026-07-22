import { Replacement } from '../../../domain/entities/replacement.js';
import { ReplacementPgRepository } from '../../../infrastructure/database/repositories/replacement.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { UpdateReplacementDTO } from '@dms/pkg-validation';

export class UpdateReplacementUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(private repRepo: ReplacementPgRepository) {}

  async execute(
    principal: Principal,
    id: string,
    dto: UpdateReplacementDTO
  ): Promise<Replacement> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'replacement:update')) {
      throw new Error('Forbidden: Insufficient permissions to update replacement');
    }

    // 2. Fetch existing entity
    const existing = await this.repRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`Replacement with ID ${id} not found`);
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
    await this.repRepo.save(existing);

    // 6. Record outbox event
    const eventEnvelope = makeEnvelope(
      'distributor.replacement.status_updated',
      'v1',
      {
        replacementId: existing.id,
        replacementNumber: existing.replacementNumber,
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
        'Replacement',
        existing.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    return existing;
  }
}
