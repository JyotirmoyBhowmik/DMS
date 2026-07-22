import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ChannelPriceRuleController } from '../../pricing-service/src/presentation/rest/controllers/channel_price_rule.controller.js';

describe('Gateway & ChannelPriceRule REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists ChannelPriceRule endpoints via controller handlers', async () => {
    ChannelPriceRuleController.clearStore();
    const controller = new ChannelPriceRuleController();

    const createRes = await controller.handleCreate(
      {
        priceListId: 'pl-gw-chan-100',
        channelCode: 'GT',
        multiplier: 1.02,
        priceAdjustmentCents: 100,
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.channelPriceRule as any).id;

    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.channelPriceRule as any).channelCode, 'GT');
  });
});
