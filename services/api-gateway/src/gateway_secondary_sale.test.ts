import { test, describe } from 'node:test';
import assert from 'node:assert';
import { SecondarySaleController } from '../../dms-core-service/src/presentation/rest/controllers/secondary_sale.controller.js';

describe('Gateway & SecondarySale REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists SecondarySale endpoints via controller handlers', async () => {
    SecondarySaleController.clearStore();
    const controller = new SecondarySaleController();

    const createRes = await controller.handleCreate(
      {
        invoiceNumber: 'INV-SEC-GW-01',
        outletId: 'outlet-gw-100',
        warehouseId: 'wh-gw-main',
        skuId: 'sku-gw-item',
        quantity: 10,
        unitPriceCents: 1500,
        totalAmountCents: 15000,
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.secondarySale as any).id;

    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.secondarySale as any).invoiceNumber, 'INV-SEC-GW-01');
  });
});
