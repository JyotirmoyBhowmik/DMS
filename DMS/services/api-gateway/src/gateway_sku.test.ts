import { test, describe } from 'node:test';
import assert from 'node:assert';
import { SkuController } from '../../dms-core-service/src/presentation/rest/controllers/sku.controller.js';

describe('Gateway & SKU REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists SKU endpoints via controller handlers', async () => {
    SkuController.clearStore();
    const controller = new SkuController();

    // 1. Create SKU
    const createRes = await controller.handleCreate(
      {
        code: 'GW-SKU-001',
        name: 'Gateway Test SKU',
        unitPrice: 999,
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.sku as any).id;

    // 2. Query SKU Details
    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.sku as any).code, 'GW-SKU-001');

    // 3. Update SKU
    const updateRes = await controller.handleUpdate(
      createdId,
      {
        unitPrice: 1299,
        version: 1,
      },
      headers
    );
    assert.strictEqual(updateRes.statusCode, 200);
    assert.strictEqual((updateRes.body.sku as any).unitPrice, 1299);

    // 4. Negative Security Test: Forbidden for unauthorized role
    const forbiddenRes = await controller.handleCreate(
      {
        code: 'GW-SKU-FORBIDDEN',
        name: 'Forbidden SKU',
        unitPrice: 100,
      },
      { ...headers, 'x-user-roles': 'unauthorized_role' }
    );
    assert.strictEqual(forbiddenRes.statusCode, 403);
  });
});
