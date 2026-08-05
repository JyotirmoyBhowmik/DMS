import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ProductCategoryController } from '../../dms-core-service/src/presentation/rest/controllers/product_category.controller.js';

describe('Gateway & ProductCategory REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists ProductCategory endpoints via controller handlers', async () => {
    ProductCategoryController.clearStore();
    const controller = new ProductCategoryController();

    // 1. Create ProductCategory
    const createRes = await controller.handleCreate(
      {
        code: 'GW-CAT-001',
        name: 'Gateway Category Test',
        description: 'Test category description',
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.category as any).id;

    // 2. Query ProductCategory Details
    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.category as any).code, 'GW-CAT-001');

    // 3. Update ProductCategory
    const updateRes = await controller.handleUpdate(
      createdId,
      {
        name: 'Updated Gateway Category Test',
        version: 1,
      },
      headers
    );
    assert.strictEqual(updateRes.statusCode, 200);
    assert.strictEqual((updateRes.body.category as any).name, 'Updated Gateway Category Test');

    // 4. Negative Security Test: Forbidden for unauthorized role
    const forbiddenRes = await controller.handleCreate(
      {
        code: 'GW-CAT-FORBIDDEN',
        name: 'Forbidden Category',
      },
      { ...headers, 'x-user-roles': 'unauthorized_role' }
    );
    assert.strictEqual(forbiddenRes.statusCode, 403);
  });
});
