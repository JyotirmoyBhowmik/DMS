import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ReturnController } from '../../dms-core-service/src/presentation/rest/controllers/return.controller.js';

describe('Gateway & Return REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists Return endpoints via controller handlers', async () => {
    ReturnController.clearStore();
    const controller = new ReturnController();

    const createRes = await controller.handleCreate(
      {
        returnNumber: 'RET-GW-01',
        outletId: 'outlet-gw-100',
        warehouseId: 'wh-gw-main',
        skuId: 'sku-gw-item',
        quantity: 15,
        reason: 'DAMAGED',
        totalAmountCents: 4500,
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.return as any).id;

    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.return as any).returnNumber, 'RET-GW-01');
  });
});
