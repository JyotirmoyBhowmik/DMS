import { test, describe } from 'node:test';
import assert from 'node:assert';
import { BatchController } from '../../dms-core-service/src/presentation/rest/controllers/batch.controller.js';

describe('Gateway & Batch REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, and lists Batch endpoints via controller handlers', async () => {
    BatchController.clearStore();
    const controller = new BatchController();
    const expiry = new Date(Date.now() + 86400000 * 30).toISOString();

    const createRes = await controller.handleCreate(
      {
        batchNumber: 'BATCH-GW-01',
        productId: 'prod-gw-01',
        warehouseId: 'wh-gw-01',
        quantity: 500,
        expiryDate: expiry,
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.batch as any).id;

    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.batch as any).batchNumber, 'BATCH-GW-01');
  });
});
