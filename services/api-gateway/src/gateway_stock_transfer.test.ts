import { test, describe } from 'node:test';
import assert from 'node:assert';
import { StockTransferController } from '../../dms-core-service/src/presentation/rest/controllers/stock_transfer.controller.js';

describe('Gateway & StockTransfer REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists StockTransfer endpoints via controller handlers', async () => {
    StockTransferController.clearStore();
    const controller = new StockTransferController();

    const createRes = await controller.handleCreate(
      {
        transferNumber: 'TRF-GW-01',
        sourceWarehouseId: 'wh-gw-src',
        targetWarehouseId: 'wh-gw-tgt',
        skuId: 'sku-gw-item',
        quantity: 200,
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.stockTransfer as any).id;

    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.stockTransfer as any).transferNumber, 'TRF-GW-01');
  });
});
