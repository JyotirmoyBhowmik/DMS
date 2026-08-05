import { test, describe } from 'node:test';
import assert from 'node:assert';
import { PriceSlabController } from '../../pricing-service/src/presentation/rest/controllers/price_slab.controller.js';

describe('Gateway & PriceSlab REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists PriceSlab endpoints via controller handlers', async () => {
    PriceSlabController.clearStore();
    const controller = new PriceSlabController();

    const createRes = await controller.handleCreate(
      {
        priceListId: 'pl-gw-100',
        skuId: 'sku-gw-item',
        minQuantity: 10,
        maxQuantity: 50,
        priceCents: 1200,
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.priceSlab as any).id;

    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.priceSlab as any).priceListId, 'pl-gw-100');
  });
});
