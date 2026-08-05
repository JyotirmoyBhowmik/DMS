import { test, describe } from 'node:test';
import assert from 'node:assert';
import { GatewayController } from './presentation/rest/controllers/gateway.controller.js';
import { DistributorHierarchyController } from '../../dms-core-service/src/presentation/rest/controllers/distributor-hierarchy.controller.js';

describe('Gateway & DistributorHierarchy API Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates and queries DistributorHierarchy endpoints via controller handlers', async () => {
    DistributorHierarchyController.clearStore?.();
    const controller = new DistributorHierarchyController();

    // 1. Create Hierarchy Mapping
    const createRes = await controller.handleCreate(
      {
        parentDistributorId: '11111111-1111-1111-1111-111111111111',
        childDistributorId: '22222222-2222-2222-2222-222222222222',
        hierarchyLevel: 'SUPER_STOCKIST',
        territory: 'Western Division',
        effectiveFrom: '2026-01-01',
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.hierarchy as any).id;

    // 2. Fetch Hierarchy Detail
    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.hierarchy as any).territory, 'Western Division');

    // 3. List Hierarchies
    const listRes = await controller.handleList({ page: '1', pageSize: '10' }, headers);
    assert.strictEqual(listRes.statusCode, 200);
    assert.strictEqual((listRes.body as any).total, 1);

    // 4. Negative Security Test: Forbidden for unauthorized role
    const forbiddenRes = await controller.handleCreate(
      {
        parentDistributorId: '11111111-1111-1111-1111-111111111111',
        childDistributorId: '33333333-3333-3333-3333-333333333333',
        hierarchyLevel: 'CNF',
        territory: 'Southern Division',
        effectiveFrom: '2026-01-01',
      },
      { ...headers, 'x-user-roles': 'unauthorized_role' }
    );
    assert.strictEqual(forbiddenRes.statusCode, 403);
  });
});
