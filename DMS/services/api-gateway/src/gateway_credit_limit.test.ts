import { test, describe } from 'node:test';
import assert from 'node:assert';
import { CreditLimitController } from '../../dms-core-service/src/presentation/rest/controllers/credit-limit.controller.js';
import { randomUUID } from 'node:crypto';

describe('Gateway & CreditLimit REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and utilizes CreditLimit endpoints via controller handlers', async () => {
    CreditLimitController.clearStore();
    const controller = new CreditLimitController();

    const distId = randomUUID();

    // 1. Create Credit Limit
    const createRes = await controller.handleCreate(
      {
        distributorId: distId,
        creditLimit: 300000,
        creditRating: 'A',
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.creditLimit as any).id;

    // 2. Query Credit Limit Details
    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.creditLimit as any).creditLimit, 300000);

    // 3. Utilize Credit Limit
    const utilizeRes = await controller.handleUtilize(
      createdId,
      {
        amount: 50000,
        version: 1,
      },
      headers
    );
    assert.strictEqual(utilizeRes.statusCode, 200);
    assert.strictEqual((utilizeRes.body.creditLimit as any).utilizedAmount, 50000);

    // 4. Negative Security Test: Forbidden for unauthorized role
    const forbiddenRes = await controller.handleCreate(
      {
        distributorId: distId,
        creditLimit: 500000,
      },
      { ...headers, 'x-user-roles': 'unauthorized_role' }
    );
    assert.strictEqual(forbiddenRes.statusCode, 403);
  });
});
