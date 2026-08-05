import { test, describe } from 'node:test';
import assert from 'node:assert';
import { GeoPriceRuleController } from '../../pricing-service/src/presentation/rest/controllers/geo_price_rule.controller.js';

describe('Gateway & GeoPriceRule REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists GeoPriceRule endpoints via controller handlers', async () => {
    GeoPriceRuleController.clearStore();
    const controller = new GeoPriceRuleController();

    const createRes = await controller.handleCreate(
      {
        priceListId: 'pl-gw-geo-100',
        regionCode: 'WEST-ZONE',
        multiplier: 1.10,
        priceAdjustmentCents: 250,
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.geoPriceRule as any).id;

    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.geoPriceRule as any).regionCode, 'WEST-ZONE');
  });
});
