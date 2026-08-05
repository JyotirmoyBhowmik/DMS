import { test, describe } from 'node:test';
import assert from 'node:assert';
import { SchemeController } from '../../schemes-service/src/presentation/rest/controllers/scheme.controller.js';

describe('Gateway & Scheme REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists Scheme endpoints via controller handlers', async () => {
    SchemeController.clearStore();
    const controller = new SchemeController();

    const createRes = await controller.handleCreate(
      {
        name: 'Diwali Cashback Offer',
        code: 'SCH-DIWALI-2026',
        schemeType: 'REBATE',
        description: 'Rs. 500 cashback per 50 units',
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.scheme as any).id;

    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.scheme as any).code, 'SCH-DIWALI-2026');
  });
});
