import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { StockLedgerEntry } from './domain/entities/stock_ledger_entry.js';
import { StockLedgerPgRepository } from './infrastructure/database/repositories/stock_ledger.pg-repository.js';
import { CreateStockLedgerUseCase } from './application/usecases/stock_ledger/create-stock-ledger.usecase.js';
import { GetStockLedgerUseCase } from './application/usecases/stock_ledger/get-stock-ledger.usecase.js';
import { UpdateStockLedgerUseCase } from './application/usecases/stock_ledger/update-stock-ledger.usecase.js';
import { ListStockLedgersUseCase } from './application/usecases/stock_ledger/list-stock-ledgers.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('StockLedger Full Vertical Slice Unit & Repo Tests', () => {
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
    StockLedgerPgRepository.clearStore();
  });

  describe('StockLedger Domain Aggregate Invariants', () => {
    test('validates transaction types and running balance computations', () => {
      const b1 = StockLedgerEntry.computeRunningBalance(100, 'RECEIPT', 50);
      assert.strictEqual(b1, 150);

      const b2 = StockLedgerEntry.computeRunningBalance(150, 'ISSUE', 30);
      assert.strictEqual(b2, 120);

      const entry = StockLedgerEntry.create({
        id: randomUUID(),
        tenantId,
        warehouseId: 'wh-north-1',
        skuId: 'sku-bev-001',
        batchNumber: 'B-001',
        transactionType: 'RECEIPT',
        quantity: 50,
        runningBalance: 150,
      });

      assert.strictEqual(entry.runningBalance, 150);
    });
  });

  describe('StockLedger Use Cases & Repository', () => {
    test('executes Create with idempotency key and running balance calculation', async () => {
      const repo = new StockLedgerPgRepository(mockDb);
      const createUseCase = new CreateStockLedgerUseCase(repo);
      const getUseCase = new GetStockLedgerUseCase(repo);
      const updateUseCase = new UpdateStockLedgerUseCase(repo);
      const listUseCase = new ListStockLedgersUseCase(repo);

      const dto = {
        warehouseId: 'wh-south-1',
        skuId: 'sku-snk-002',
        batchNumber: 'BATCH-2026-A',
        transactionType: 'RECEIPT' as const,
        quantity: 100,
      };

      // Create initial
      const e1 = await createUseCase.execute(principal, dto, 'key-sl-101');
      assert.strictEqual(e1.runningBalance, 100);

      // Idempotent retry
      const e2 = await createUseCase.execute(principal, dto, 'key-sl-101');
      assert.strictEqual(e2.id, e1.id);

      // Get
      const fetched = await getUseCase.execute(principal, e1.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.batchNumber, 'BATCH-2026-A');

      // List
      const list = await listUseCase.execute(principal, { skuId: 'sku-snk-002' });
      assert.strictEqual(list.total, 1);

      // Update
      const updated = await updateUseCase.execute(principal, e1.id, {
        referenceId: 'REF-DOC-999',
        version: 1,
      });
      assert.strictEqual(updated.referenceId, 'REF-DOC-999');
      assert.strictEqual(updated.version, 2);
    });
  });
});
