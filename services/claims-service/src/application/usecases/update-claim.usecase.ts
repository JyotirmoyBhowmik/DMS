import { Claim } from '../../domain/entities/claim.js';
import { ClaimPgRepository } from '../../infrastructure/database/repositories/claim.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { UpdateClaimDTO } from '@dms/pkg-validation';

export class UpdateClaimUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(private claimRepo: ClaimPgRepository) {}

  async execute(
    principal: Principal,
    id: string,
    dto: UpdateClaimDTO
  ): Promise<Claim> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'claim:update')) {
      throw new Error('Forbidden: Insufficient permissions to update claim');
    }

    // 2. Fetch existing entity
    const existing = await this.claimRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`Claim with ID ${id} not found`);
    }

    // 3. Optimistic locking check
    if (dto.version !== undefined && existing.version !== dto.version) {
      throw new Error('409 Conflict: Optimistic locking failure, version mismatch');
    }

    // 4. Apply state transitions
    if (dto.status !== undefined) {
      existing.updateStatus(dto.status, dto.approvedAmountCents);
    }

    // 5. Persist updated aggregate
    await this.claimRepo.save(existing);

    // 6. Record outbox event
    const eventEnvelope = makeEnvelope(
      'claims.claim.status_updated',
      'v1',
      {
        claimId: existing.id,
        claimCode: existing.claimCode,
        status: existing.status,
        approvedAmountCents: existing.approvedAmountCents,
        version: existing.version,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'claims-service',
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
        'Claim',
        existing.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    return existing;
  }
}
