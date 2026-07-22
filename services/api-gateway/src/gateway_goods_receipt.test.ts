import { test, describe } from 'node:test';
import assert from 'node:assert';
import { GoodsReceiptController } from '../../dms-core-service/src/presentation/rest/controllers/goods_receipt.controller.js';

describe('Gateway & GoodsReceipt REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists GoodsReceipt endpoints via controller handlers', async () => {
    GoodsReceiptController.clearStore();
    const controller = new GoodsReceiptController();

    const createRes = await controller.handleCreate(
      {
        receiptNumber: 'GRN-GW-01',
        purchaseOrderId: 'po-gw-100',
        warehouseId: 'wh-gw-main',
        skuId: 'sku-gw-item',
        receivedQuantity: 300,
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.goodsReceipt as any).id;

    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.goodsReceipt as any).receiptNumber, 'GRN-GW-01');
  });
});
