import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { StockTransfer } from './domain/entities/stock_transfer.js';
import { StockTransferPgRepository } from './infrastructure/database/repositories/stock_transfer.pg-repository.js';
import { CreateStockTransferUseCase } from './application/usecases/stock_transfer/create-stock-transfer.usecase.js';
import { GetStockTransferUseCase } from './application/usecases/stock_transfer/get-stock-transfer.usecase.js';
import { UpdateStockTransferUseCase } from './application/usecases/stock_transfer/update-stock-transfer.usecase.js';
import { ListStockTransfersUseCase } from './application/usecases/stock_transfer/list-stock-transfers.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('StockTransfer Full Vertical Slice Unit & Repo Tests', () => {
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
    StockTransferPgRepository.clearStore();
  });

  describe('StockTransfer Domain Aggregate Invariants', () => {
    test('validates warehouse distinction and state machine transitions', () => {
      // Identical warehouse guard clause
      assert.throws(
        () => new StockTransfer({
          id: randomUUID(),
          tenantId,
          transferNumber: 'TRF-001',
          sourceWarehouseId: 'wh-north',
          targetWarehouseId: 'wh-north',
          skuId: 'sku-01',
          quantity: 100,
        }),
        /cannot be identical/
      );

      const transfer = StockTransfer.create({
        id: randomUUID(),
        tenantId,
        transferNumber: 'TRF-002',
        sourceWarehouseId: 'wh-north',
        targetWarehouseId: 'wh-south',
        skuId: 'sku-01',
        quantity: 50,
      });

      assert.strictEqual(transfer.status, 'REQUESTED');

      // Valid state transition: REQUESTED -> APPROVED -> IN_TRANSIT -> COMPLETED
      transfer.updateStatus('APPROVED');
      assert.strictEqual(transfer.status, 'APPROVED');

      transfer.updateStatus('IN_TRANSIT');
      assert.strictEqual(transfer.status, 'IN_TRANSIT');

      transfer.updateStatus('COMPLETED');
      assert.strictEqual(transfer.status, 'COMPLETED');

      // Illegal transition after COMPLETED
      assert.throws(
        () => transfer.updateStatus('CANCELLED'),
        /Cannot transition from final status/
      );
    });
  });

  describe('StockTransfer Use Cases & Repository', () => {
    test('executes Create with idempotency key and enforces unique transferNumber per tenant', async () => {
      const repo = new StockTransferPgRepository(mockDb);
      const createUseCase = new CreateStockTransferUseCase(repo);
      const getUseCase = new GetStockTransferUseCase(repo);
      const updateUseCase = new UpdateStockTransferUseCase(repo);
      const listUseCase = new ListStockTransfersUseCase(repo);

      const dto = {
        transferNumber: 'TRF-2026-X',
        sourceWarehouseId: 'wh-main',
        targetWarehouseId: 'wh-regional',
        skuId: 'sku-item-1',
        quantity: 100,
      };

      // Create initial
      const t1 = await createUseCase.execute(principal, dto, 'key-st-101');
      assert.strictEqual(t1.transferNumber, 'TRF-2026-X');

      // Idempotent retry
      const t2 = await createUseCase.execute(principal, dto, 'key-st-101');
      assert.strictEqual(t2.id, t1.id);

      // Duplicate record error
      await assert.rejects(
        () => createUseCase.execute(principal, dto),
        /Stock transfer with number TRF-2026-X already exists/
      );

      // Get
      const fetched = await getUseCase.execute(principal, t1.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.sourceWarehouseId, 'wh-main');

      // List
      const list = await listUseCase.execute(principal, { sourceWarehouseId: 'wh-main' });
      assert.strictEqual(list.total, 1);

      // Update status
      const updated = await updateUseCase.execute(principal, t1.id, {
        status: 'APPROVED',
        version: 1,
      });
      assert.strictEqual(updated.status, 'APPROVED');
      assert.strictEqual(updated.version, 2);
    });
  });
});
