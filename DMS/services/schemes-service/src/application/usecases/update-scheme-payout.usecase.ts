import { SchemePayout } from '../../domain/entities/scheme_payout.js';
import { SchemePayoutPgRepository } from '../../infrastructure/database/repositories/scheme_payout.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { UpdateSchemePayoutDTO } from '@dms/pkg-validation';

export class UpdateSchemePayoutUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(private payoutRepo: SchemePayoutPgRepository) {}

  async execute(
    principal: Principal,
    id: string,
    dto: UpdateSchemePayoutDTO
  ): Promise<SchemePayout> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'scheme_payout:update')) {
      throw new Error('Forbidden: Insufficient permissions to update scheme payout');
    }

    // 2. Fetch existing entity
    const existing = await this.payoutRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`SchemePayout with ID ${id} not found`);
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
    await this.payoutRepo.save(existing);

    // 6. Record outbox event
    const eventEnvelope = makeEnvelope(
      'schemes.scheme_payout.status_updated',
      'v1',
      {
        payoutId: existing.id,
        payoutCode: existing.payoutCode,
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
        'SchemePayout',
        existing.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    return existing;
  }
}
