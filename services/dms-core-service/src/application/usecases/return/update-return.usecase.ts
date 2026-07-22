import { ReturnEntity } from '../../../domain/entities/return.js';
import { ReturnPgRepository } from '../../../infrastructure/database/repositories/return.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { UpdateReturnDTO } from '@dms/pkg-validation';

export class UpdateReturnUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(private returnRepo: ReturnPgRepository) {}

  async execute(
    principal: Principal,
    id: string,
    dto: UpdateReturnDTO
  ): Promise<ReturnEntity> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'return:update')) {
      throw new Error('Forbidden: Insufficient permissions to update return');
    }

    // 2. Fetch existing entity
    const existing = await this.returnRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`Return with ID ${id} not found`);
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
    await this.returnRepo.save(existing);

    // 6. Record outbox event
    const eventEnvelope = makeEnvelope(
      'distributor.return.status_updated',
      'v1',
      {
        returnId: existing.id,
        returnNumber: existing.returnNumber,
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
        'Return',
        existing.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    return existing;
  }
}
