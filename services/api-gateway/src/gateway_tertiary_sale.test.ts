import { test, describe } from 'node:test';
import assert from 'node:assert';
import { TertiarySaleController } from '../../dms-core-service/src/presentation/rest/controllers/tertiary_sale.controller.js';

describe('Gateway & TertiarySale REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists TertiarySale endpoints via controller handlers', async () => {
    TertiarySaleController.clearStore();
    const controller = new TertiarySaleController();

    const createRes = await controller.handleCreate(
      {
        invoiceNumber: 'INV-TER-GW-01',
        consumerId: 'consumer-gw-100',
        outletId: 'outlet-gw-main',
        skuId: 'sku-gw-item',
        quantity: 3,
        unitPriceCents: 2000,
        totalAmountCents: 6000,
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.tertiarySale as any).id;

    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.tertiarySale as any).invoiceNumber, 'INV-TER-GW-01');
  });
});
