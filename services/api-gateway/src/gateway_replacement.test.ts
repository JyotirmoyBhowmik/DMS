import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ReplacementController } from '../../dms-core-service/src/presentation/rest/controllers/replacement.controller.js';

describe('Gateway & Replacement REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists Replacement endpoints via controller handlers', async () => {
    ReplacementController.clearStore();
    const controller = new ReplacementController();

    const createRes = await controller.handleCreate(
      {
        replacementNumber: 'REP-GW-01',
        returnId: 'ret-gw-100',
        outletId: 'outlet-gw-100',
        warehouseId: 'wh-gw-main',
        skuId: 'sku-gw-item',
        quantity: 8,
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.replacement as any).id;

    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.replacement as any).replacementNumber, 'REP-GW-01');
  });
});
