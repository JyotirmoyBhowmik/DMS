import { test, describe } from 'node:test';
import assert from 'node:assert';
import { OutletController } from '../../dms-core-service/src/presentation/rest/controllers/outlet.controller.js';

describe('Gateway & Outlet REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists Outlet endpoints via controller handlers', async () => {
    OutletController.clearStore();
    const controller = new OutletController();

    // 1. Create Outlet
    const createRes = await controller.handleCreate(
      {
        name: 'Corner Retail Store',
        latitude: 12.9716,
        longitude: 77.5946,
        radiusMeters: 100,
        channelType: 'RETAIL',
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.outlet as any).id;

    // 2. Query Outlet Details
    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.outlet as any).name, 'Corner Retail Store');

    // 3. Update Outlet
    const updateRes = await controller.handleUpdate(
      createdId,
      {
        name: 'Corner Retail Store Deluxe',
        version: 1,
      },
      headers
    );
    assert.strictEqual(updateRes.statusCode, 200);
    assert.strictEqual((updateRes.body.outlet as any).name, 'Corner Retail Store Deluxe');

    // 4. Negative Security Test: Forbidden for unauthorized role
    const forbiddenRes = await controller.handleCreate(
      {
        name: 'Forbidden Outlet',
        latitude: 12.9716,
        longitude: 77.5946,
      },
      { ...headers, 'x-user-roles': 'unauthorized_role' }
    );
    assert.strictEqual(forbiddenRes.statusCode, 403);
  });
});
