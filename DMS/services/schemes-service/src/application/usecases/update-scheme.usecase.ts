import { Scheme } from '../../domain/entities/scheme.js';
import { SchemePgRepository } from '../../infrastructure/database/repositories/scheme.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { UpdateSchemeDTO } from '@dms/pkg-validation';

export class UpdateSchemeUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(private schemeRepo: SchemePgRepository) {}

  async execute(
    principal: Principal,
    id: string,
    dto: UpdateSchemeDTO
  ): Promise<Scheme> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'scheme:update')) {
      throw new Error('Forbidden: Insufficient permissions to update scheme');
    }

    // 2. Fetch existing entity
    const existing = await this.schemeRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`Scheme with ID ${id} not found`);
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
    await this.schemeRepo.save(existing);

    // 6. Record outbox event
    const eventEnvelope = makeEnvelope(
      'schemes.scheme.status_updated',
      'v1',
      {
        schemeId: existing.id,
        code: existing.code,
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
        'Scheme',
        existing.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    return existing;
  }
}
