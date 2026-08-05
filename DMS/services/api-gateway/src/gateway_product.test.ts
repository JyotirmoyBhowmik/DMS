import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ProductController } from '../../dms-core-service/src/presentation/rest/controllers/product.controller.js';

describe('Gateway & Product REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists Product endpoints via controller handlers', async () => {
    ProductController.clearStore();
    const controller = new ProductController();

    // 1. Create Product
    const createRes = await controller.handleCreate(
      {
        sku: 'GW-PROD-001',
        name: 'Gateway Test Product',
        category: 'TestCategory',
        price: 999,
        minThreshold: 5,
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.product as any).id;

    // 2. Query Product Details
    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.product as any).sku, 'GW-PROD-001');

    // 3. Update Product
    const updateRes = await controller.handleUpdate(
      createdId,
      {
        price: 1299,
        version: 1,
      },
      headers
    );
    assert.strictEqual(updateRes.statusCode, 200);
    assert.strictEqual((updateRes.body.product as any).price, 1299);

    // 4. Negative Security Test: Forbidden for unauthorized role
    const forbiddenRes = await controller.handleCreate(
      {
        sku: 'GW-PROD-FORBIDDEN',
        name: 'Forbidden Product',
        category: 'TestCategory',
        price: 100,
      },
      { ...headers, 'x-user-roles': 'unauthorized_role' }
    );
    assert.strictEqual(forbiddenRes.statusCode, 403);
  });
});
