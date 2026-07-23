import { SlabReward } from '../../domain/entities/slab_reward.js';
import { SlabRewardPgRepository } from '../../infrastructure/database/repositories/slab_reward.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export class GetSlabRewardUseCase {
  constructor(private rewardRepo: SlabRewardPgRepository) {}

  async execute(principal: Principal, id: string): Promise<SlabReward | null> {
    // 1. Authorize read permission
    if (!RbacGuard.can(principal, 'slab_reward:read') && !RbacGuard.can(principal, 'slab_rewards:read')) {
      throw new Error('Forbidden: Insufficient permissions to read slab reward record');
    }

    // 2. Fetch record scoped to tenant
    const reward = await this.rewardRepo.findById(principal.tenantId, id);

    // 3. Prevent cross-tenant existence leakage
    if (!reward || reward.tenantId !== principal.tenantId) {
      return null;
    }

    return reward;
  }
}
