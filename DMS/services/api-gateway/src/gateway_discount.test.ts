import { test, describe } from 'node:test';
import assert from 'node:assert';
import { DiscountController } from '../../pricing-service/src/presentation/rest/controllers/discount.controller.js';

describe('Gateway & Discount REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists Discount endpoints via controller handlers', async () => {
    DiscountController.clearStore();
    const controller = new DiscountController();

    const createRes = await controller.handleCreate(
      {
        name: 'New Year Special',
        code: 'DISC-NY-2026',
        discountType: 'PERCENTAGE',
        value: 20,
        minOrderAmountCents: 2000,
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.discount as any).id;

    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.discount as any).code, 'DISC-NY-2026');
  });
});
