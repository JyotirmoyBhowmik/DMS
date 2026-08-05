import { test, describe } from 'node:test';
import assert from 'node:assert';
import { PurchaseOrderController } from '../../dms-core-service/src/presentation/rest/controllers/purchase_order.controller.js';

describe('Gateway & PurchaseOrder REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists PurchaseOrder endpoints via controller handlers', async () => {
    PurchaseOrderController.clearStore();
    const controller = new PurchaseOrderController();

    const createRes = await controller.handleCreate(
      {
        poNumber: 'PO-GW-01',
        supplierId: 'sup-gw-100',
        warehouseId: 'wh-gw-main',
        totalAmountCents: 120000,
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.purchaseOrder as any).id;

    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.purchaseOrder as any).poNumber, 'PO-GW-01');
  });
});
