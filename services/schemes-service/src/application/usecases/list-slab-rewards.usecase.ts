import { SlabReward, SlabRewardStatus, RewardType } from '../../domain/entities/slab_reward.js';
import { SlabRewardPgRepository } from '../../infrastructure/database/repositories/slab_reward.pg-repository.js';
import { Principal, RbacGuard } from '@dms/pkg-rbac';

export interface ListSlabRewardsQuery {
  status?: SlabRewardStatus;
  schemeId?: string;
  slabCode?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedSlabRewards {
  data: SlabReward[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class ListSlabRewardsUseCase {
  constructor(private rewardRepo: SlabRewardPgRepository) {}

  async execute(principal: Principal, query: ListSlabRewardsQuery): Promise<PaginatedSlabRewards> {
    // 1. Authorize permission
    if (!RbacGuard.can(principal, 'slab_reward:read') && !RbacGuard.can(principal, 'slab_rewards:read')) {
      throw new Error('Forbidden: Insufficient permissions to list slab rewards');
    }

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    // 2. Fetch records
    let items = await this.rewardRepo.findAll(principal.tenantId);

    if (query.status) {
      items = items.filter(r => r.status === query.status);
    }
    if (query.schemeId) {
      items = items.filter(r => r.schemeId === query.schemeId);
    }
    if (query.slabCode) {
      items = items.filter(r => r.slabCode === query.slabCode);
    }

    const total = items.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const offset = (page - 1) * pageSize;
    const paginatedData = items.slice(offset, offset + pageSize);

    return {
      data: paginatedData,
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}
