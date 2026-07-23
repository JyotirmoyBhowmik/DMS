import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { SlabReward } from './domain/entities/slab_reward.js';
import { SlabRewardPgRepository } from './infrastructure/database/repositories/slab_reward.pg-repository.js';
import { CreateSlabRewardUseCase } from './application/usecases/create-slab-reward.usecase.js';
import { GetSlabRewardUseCase } from './application/usecases/get-slab-reward.usecase.js';
import { UpdateSlabRewardUseCase } from './application/usecases/update-slab-reward.usecase.js';
import { ListSlabRewardsUseCase } from './application/usecases/list-slab-rewards.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('SlabReward Full Vertical Slice Unit & Repo Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const principal: Principal = {
    id: 'admin-user-1',
    tenantId,
    roles: ['admin'],
  };

  const mockDb: any = {
    query: async () => ({ rows: [] }),
  };

  beforeEach(() => {
    SlabRewardPgRepository.clearStore();
  });

  describe('SlabReward Domain Aggregate Invariants', () => {
    test('validates minQualifyingQty and rewardValueCents ranges, and state machine transitions', () => {
      // Invalid min qualifying qty guard clause
      assert.throws(
        () => new SlabReward({
          id: randomUUID(),
          tenantId,
          schemeId: randomUUID(),
          name: 'Invalid Qty',
          slabCode: 'SLAB-INVALID',
          minQualifyingQty: -10,
        }),
        /minQualifyingQty must be non-negative/
      );

      const reward = SlabReward.create({
        id: randomUUID(),
        tenantId,
        schemeId: randomUUID(),
        name: 'Buy 50 Cases Tier',
        slabCode: 'SLAB-50-CASES',
        minQualifyingQty: 50,
        rewardType: 'CASHBACK',
        rewardValueCents: 150000,
      });

      assert.strictEqual(reward.status, 'ACTIVE');

      // State transition: ACTIVE -> INACTIVE
      reward.updateStatus('INACTIVE');
      assert.strictEqual(reward.status, 'INACTIVE');
    });
  });

  describe('SlabReward Use Cases & Repository', () => {
    test('executes Create with idempotency key and enforces unique slab code per scheme', async () => {
      const repo = new SlabRewardPgRepository(mockDb);
      const createUseCase = new CreateSlabRewardUseCase(repo);
      const getUseCase = new GetSlabRewardUseCase(repo);
      const updateUseCase = new UpdateSlabRewardUseCase(repo);
      const listUseCase = new ListSlabRewardsUseCase(repo);

      const schemeId = randomUUID();
      const dto = {
        name: 'Buy 100 Cases Free Product',
        slabCode: 'SLAB-100-FREE',
        schemeId,
        minQualifyingQty: 100,
        rewardType: 'FREE_PRODUCT' as const,
        rewardSkuId: 'sku-free-item-99',
      };

      // Create initial
      const r1 = await createUseCase.execute(principal, dto, 'key-slab-101');
      assert.strictEqual(r1.slabCode, 'SLAB-100-FREE');

      // Idempotent retry
      const r2 = await createUseCase.execute(principal, dto, 'key-slab-101');
      assert.strictEqual(r2.id, r1.id);

      // Duplicate record error
      await assert.rejects(
        () => createUseCase.execute(principal, dto),
        /SlabReward with code SLAB-100-FREE already exists for this scheme/
      );

      // Get
      const fetched = await getUseCase.execute(principal, r1.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.name, 'Buy 100 Cases Free Product');

      // List
      const list = await listUseCase.execute(principal, { slabCode: 'SLAB-100-FREE' });
      assert.strictEqual(list.total, 1);

      // Update status
      const updated = await updateUseCase.execute(principal, r1.id, {
        status: 'INACTIVE',
        version: 1,
      });
      assert.strictEqual(updated.status, 'INACTIVE');
      assert.strictEqual(updated.version, 2);
    });
  });
});
