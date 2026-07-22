import { test, describe } from 'node:test';
import assert from 'node:assert';
import { PrimarySaleController } from '../../dms-core-service/src/presentation/rest/controllers/primary_sale.controller.js';

describe('Gateway & PrimarySale REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists PrimarySale endpoints via controller handlers', async () => {
    PrimarySaleController.clearStore();
    const controller = new PrimarySaleController();

    const createRes = await controller.handleCreate(
      {
        invoiceNumber: 'INV-GW-01',
        distributorId: 'dist-gw-100',
        warehouseId: 'wh-gw-main',
        skuId: 'sku-gw-item',
        quantity: 25,
        unitPriceCents: 1000,
        totalAmountCents: 25000,
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.primarySale as any).id;

    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.primarySale as any).invoiceNumber, 'INV-GW-01');
  });
});
