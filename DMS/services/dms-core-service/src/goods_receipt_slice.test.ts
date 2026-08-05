import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { GoodsReceipt } from './domain/entities/goods_receipt.js';
import { GoodsReceiptPgRepository } from './infrastructure/database/repositories/goods_receipt.pg-repository.js';
import { CreateGoodsReceiptUseCase } from './application/usecases/goods_receipt/create-goods-receipt.usecase.js';
import { GetGoodsReceiptUseCase } from './application/usecases/goods_receipt/get-goods-receipt.usecase.js';
import { UpdateGoodsReceiptUseCase } from './application/usecases/goods_receipt/update-goods-receipt.usecase.js';
import { ListGoodsReceiptsUseCase } from './application/usecases/goods_receipt/list-goods-receipts.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('GoodsReceipt Full Vertical Slice Unit & Repo Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const principal: Principal = {
    id: 'admin-user-1',
    tenantId,
    roles: ['admin'],
  };

  const mockDb: any = {
    query: async () => ({ rows: [] }),
  };

  beforeEach(() => {
    GoodsReceiptPgRepository.clearStore();
  });

  describe('GoodsReceipt Domain Aggregate Invariants', () => {
    test('validates receivedQuantity guard clause and state machine transitions', () => {
      // Non-positive quantity guard clause
      assert.throws(
        () => new GoodsReceipt({
          id: randomUUID(),
          tenantId,
          receiptNumber: 'GRN-001',
          purchaseOrderId: 'po-01',
          warehouseId: 'wh-01',
          skuId: 'sku-01',
          receivedQuantity: 0,
        }),
        /receivedQuantity must be positive/
      );

      const gr = GoodsReceipt.create({
        id: randomUUID(),
        tenantId,
        receiptNumber: 'GRN-002',
        purchaseOrderId: 'po-02',
        warehouseId: 'wh-main',
        skuId: 'sku-02',
        receivedQuantity: 50,
      });

      assert.strictEqual(gr.status, 'DRAFT');

      // Valid state transition: DRAFT -> VERIFIED -> POSTED
      gr.updateStatus('VERIFIED');
      assert.strictEqual(gr.status, 'VERIFIED');

      gr.updateStatus('POSTED');
      assert.strictEqual(gr.status, 'POSTED');

      // Illegal transition after POSTED
      assert.throws(
        () => gr.updateStatus('REJECTED'),
        /Cannot transition from final status/
      );
    });
  });

  describe('GoodsReceipt Use Cases & Repository', () => {
    test('executes Create with idempotency key and enforces unique receiptNumber per tenant', async () => {
      const repo = new GoodsReceiptPgRepository(mockDb);
      const createUseCase = new CreateGoodsReceiptUseCase(repo);
      const getUseCase = new GetGoodsReceiptUseCase(repo);
      const updateUseCase = new UpdateGoodsReceiptUseCase(repo);
      const listUseCase = new ListGoodsReceiptsUseCase(repo);

      const dto = {
        receiptNumber: 'GRN-2026-X',
        purchaseOrderId: 'po-101',
        warehouseId: 'wh-main',
        skuId: 'sku-item-1',
        receivedQuantity: 150,
      };

      // Create initial
      const g1 = await createUseCase.execute(principal, dto, 'key-gr-101');
      assert.strictEqual(g1.receiptNumber, 'GRN-2026-X');

      // Idempotent retry
      const g2 = await createUseCase.execute(principal, dto, 'key-gr-101');
      assert.strictEqual(g2.id, g1.id);

      // Duplicate record error
      await assert.rejects(
        () => createUseCase.execute(principal, dto),
        /Goods receipt with number GRN-2026-X already exists/
      );

      // Get
      const fetched = await getUseCase.execute(principal, g1.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.purchaseOrderId, 'po-101');

      // List
      const list = await listUseCase.execute(principal, { purchaseOrderId: 'po-101' });
      assert.strictEqual(list.total, 1);

      // Update status
      const updated = await updateUseCase.execute(principal, g1.id, {
        status: 'VERIFIED',
        version: 1,
      });
      assert.strictEqual(updated.status, 'VERIFIED');
      assert.strictEqual(updated.version, 2);
    });
  });
});
