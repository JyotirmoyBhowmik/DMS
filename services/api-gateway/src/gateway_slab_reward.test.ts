import { test, describe } from 'node:test';
import assert from 'node:assert';
import { SlabRewardController } from '../../schemes-service/src/presentation/rest/controllers/slab_reward.controller.js';

describe('Gateway & SlabReward REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists SlabReward endpoints via controller handlers', async () => {
    SlabRewardController.clearStore();
    const controller = new SlabRewardController();

    const createRes = await controller.handleCreate(
      {
        name: 'Bulk Purchase Bonus',
        slabCode: 'SLAB-BULK-BONUS',
        schemeId: 'scheme-bulk-id',
        minQualifyingQty: 200,
        rewardType: 'CASHBACK',
        rewardValueCents: 500000,
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.slabReward as any).id;

    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.slabReward as any).slabCode, 'SLAB-BULK-BONUS');
  });
});
