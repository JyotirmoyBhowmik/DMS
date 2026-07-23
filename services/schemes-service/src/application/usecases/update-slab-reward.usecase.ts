import { SlabReward } from '../../domain/entities/slab_reward.js';
import { SlabRewardPgRepository } from '../../infrastructure/database/repositories/slab_reward.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { UpdateSlabRewardDTO } from '@dms/pkg-validation';

export class UpdateSlabRewardUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });

  constructor(private rewardRepo: SlabRewardPgRepository) {}

  async execute(
    principal: Principal,
    id: string,
    dto: UpdateSlabRewardDTO
  ): Promise<SlabReward> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'slab_reward:update')) {
      throw new Error('Forbidden: Insufficient permissions to update slab reward');
    }

    // 2. Fetch existing entity
    const existing = await this.rewardRepo.findById(principal.tenantId, id);
    if (!existing || existing.tenantId !== principal.tenantId) {
      throw new Error(`SlabReward with ID ${id} not found`);
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
    await this.rewardRepo.save(existing);

    // 6. Record outbox event
    const eventEnvelope = makeEnvelope(
      'schemes.slab_reward.status_updated',
      'v1',
      {
        rewardId: existing.id,
        slabCode: existing.slabCode,
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
        'SlabReward',
        existing.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    return existing;
  }
}
