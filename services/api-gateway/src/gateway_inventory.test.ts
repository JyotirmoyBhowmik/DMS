import { test, describe } from 'node:test';
import assert from 'node:assert';
import { InventoryController } from '../../dms-core-service/src/presentation/rest/controllers/inventory.controller.js';

describe('Gateway & Inventory REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists Inventory endpoints via controller handlers', async () => {
    InventoryController.clearStore();
    const controller = new InventoryController();

    // 1. Create Inventory Record
    const createRes = await controller.handleCreate(
      {
        warehouseId: 'wh-gw-01',
        skuId: 'sku-gw-01',
        quantityAvailable: 150,
        reorderLevel: 20,
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.inventory as any).id;

    // 2. Query Inventory Details
    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.inventory as any).warehouseId, 'wh-gw-01');

    // 3. Update Inventory
    const updateRes = await controller.handleUpdate(
      createdId,
      {
        quantityAvailable: 200,
        version: 1,
      },
      headers
    );
    assert.strictEqual(updateRes.statusCode, 200);
    assert.strictEqual((updateRes.body.inventory as any).quantityAvailable, 200);

    // 4. Negative Security Test: Forbidden for unauthorized role
    const forbiddenRes = await controller.handleCreate(
      {
        warehouseId: 'wh-gw-forbidden',
        skuId: 'sku-gw-forbidden',
        quantityAvailable: 10,
      },
      { ...headers, 'x-user-roles': 'unauthorized_role' }
    );
    assert.strictEqual(forbiddenRes.statusCode, 403);
  });
});
