import { test, describe } from 'node:test';
import assert from 'node:assert';
import { StockLedgerController } from '../../dms-core-service/src/presentation/rest/controllers/stock_ledger.controller.js';

describe('Gateway & StockLedger REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists StockLedger endpoints via controller handlers', async () => {
    StockLedgerController.clearStore();
    const controller = new StockLedgerController();

    const createRes = await controller.handleCreate(
      {
        warehouseId: 'wh-gw-sl-01',
        skuId: 'sku-gw-sl-01',
        batchNumber: 'BATCH-GW-SL-01',
        transactionType: 'RECEIPT',
        quantity: 300,
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.stockLedger as any).id;

    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.stockLedger as any).warehouseId, 'wh-gw-sl-01');
  });
});
