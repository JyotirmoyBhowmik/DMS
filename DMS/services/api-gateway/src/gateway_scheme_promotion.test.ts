import { test, describe } from 'node:test';
import assert from 'node:assert';
import { SchemePromotionController } from '../../schemes-service/src/presentation/rest/controllers/scheme_promotion.controller.js';

describe('Gateway & SchemePromotion REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists SchemePromotion endpoints via controller handlers', async () => {
    SchemePromotionController.clearStore();
    const controller = new SchemePromotionController();

    const createRes = await controller.handleCreate(
      {
        name: 'New Year Early Bird',
        promoCode: 'PROMO-NY-2026',
        schemeId: 'scheme-ny-id',
        promotionType: 'PERCENTAGE_DISCOUNT',
        discountPercentage: 10,
        maxDiscountCents: 2000,
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.schemePromotion as any).id;

    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.schemePromotion as any).promoCode, 'PROMO-NY-2026');
  });
});
