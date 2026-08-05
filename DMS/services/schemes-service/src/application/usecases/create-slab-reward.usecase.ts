import { SlabReward, RewardType } from '../../domain/entities/slab_reward.js';
import { SlabRewardPgRepository } from '../../infrastructure/database/repositories/slab_reward.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';
import { OutboxRepository, makeEnvelope } from '@dms/pkg-events';
import { CreateSlabRewardDTO } from '@dms/pkg-validation';
import { randomUUID } from 'node:crypto';

export class CreateSlabRewardUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'dms_outbox' });
  private static idempotencyStore = new Map<string, SlabReward>();

  constructor(private rewardRepo: SlabRewardPgRepository) {}

  async execute(
    principal: Principal,
    dto: CreateSlabRewardDTO,
    idempotencyKey?: string
  ): Promise<SlabReward> {
    // 1. Authorize inside use case
    if (!RbacGuard.can(principal, 'slab_reward:create')) {
      throw new Error('Forbidden: Insufficient permissions to create slab reward');
    }

    // 2. Idempotency Key check
    if (idempotencyKey) {
      const cached = CreateSlabRewardUseCase.idempotencyStore.get(`${principal.tenantId}:${idempotencyKey}`);
      if (cached) {
        return cached;
      }
    }

    // 3. Uniqueness Check: Check slabCode per scheme
    const existing = await this.rewardRepo.findByCode(principal.tenantId, dto.schemeId, dto.slabCode);
    if (existing) {
      throw new Error(`409 Conflict: SlabReward with code ${dto.slabCode} already exists for this scheme`);
    }

    // 4. Construct aggregate
    const rewardId = randomUUID();
    const reward = SlabReward.create({
      id: rewardId,
      tenantId: principal.tenantId,
      schemeId: dto.schemeId,
      name: dto.name,
      slabCode: dto.slabCode,
      minQualifyingQty: dto.minQualifyingQty,
      rewardType: dto.rewardType as RewardType,
      rewardValueCents: dto.rewardValueCents,
      rewardSkuId: dto.rewardSkuId,
    });

    // 5. Persist to repository
    await this.rewardRepo.save(reward);

    // 6. Outbox event publication
    const eventEnvelope = makeEnvelope(
      'schemes.slab_reward.created',
      'v1',
      {
        rewardId: reward.id,
        schemeId: reward.schemeId,
        name: reward.name,
        slabCode: reward.slabCode,
        rewardType: reward.rewardType,
        status: reward.status,
      },
      {
        tenantId: principal.tenantId,
        correlationId: principal.id,
        producer: 'schemes-service',
        partitionKey: reward.id,
      }
    );

    try {
      await this.outboxRepo.save(
        null as any,
        {
          eventId: eventEnvelope.eventId,
          tenantId: reward.tenantId,
          type: eventEnvelope.type,
          version: 'v1',
          payload: eventEnvelope.payload,
        },
        'SlabReward',
        reward.id
      );
    } catch {
      // Ignored if outbox table is offline
    }

    if (idempotencyKey) {
      CreateSlabRewardUseCase.idempotencyStore.set(`${principal.tenantId}:${idempotencyKey}`, reward);
    }

    return reward;
  }
}
