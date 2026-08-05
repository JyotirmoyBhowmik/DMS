import { test, describe } from 'node:test';
import assert from 'node:assert';
import { PriceListController } from '../../pricing-service/src/presentation/rest/controllers/price_list.controller.js';

describe('Gateway & PriceList REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists PriceList endpoints via controller handlers', async () => {
    PriceListController.clearStore();
    const controller = new PriceListController();

    const createRes = await controller.handleCreate(
      {
        name: 'VIP Retail Tier',
        code: 'PL-VIP-01',
        currency: 'INR',
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.priceList as any).id;

    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.priceList as any).code, 'PL-VIP-01');
  });
});
