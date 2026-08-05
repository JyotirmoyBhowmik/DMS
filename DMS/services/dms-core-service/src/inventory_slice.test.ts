import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Inventory } from './domain/entities/inventory.js';
import { InventoryPgRepository } from './infrastructure/database/repositories/inventory.pg-repository.js';
import { CreateInventoryUseCase } from './application/usecases/inventory/create-inventory.usecase.js';
import { GetInventoryUseCase } from './application/usecases/inventory/get-inventory.usecase.js';
import { UpdateInventoryUseCase } from './application/usecases/inventory/update-inventory.usecase.js';
import { ListInventoriesUseCase } from './application/usecases/inventory/list-inventories.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('Inventory Full Vertical Slice Unit & Repo Tests', () => {
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
    InventoryPgRepository.clearStore();
  });

  describe('Inventory Domain Aggregate Invariants', () => {
    test('validates stock adjustments, reservations, and low stock statuses', () => {
      const inv = Inventory.create({
        id: randomUUID(),
        tenantId,
        warehouseId: 'wh-north-1',
        skuId: 'sku-bev-001',
        quantityAvailable: 100,
        reorderLevel: 20,
      });

      assert.strictEqual(inv.quantityAvailable, 100);
      assert.strictEqual(inv.status, 'IN_STOCK');

      // Adjust stock down to low stock threshold
      inv.adjustStock(-85);
      assert.strictEqual(inv.quantityAvailable, 15);
      assert.strictEqual(inv.status, 'LOW_STOCK');

      // Reserve stock
      inv.reserveStock(5);
      assert.strictEqual(inv.quantityAvailable, 10);
      assert.strictEqual(inv.quantityReserved, 5);

      // Insufficient stock guard clause error
      assert.throws(
        () => inv.adjustStock(-50),
        /Insufficient stock/
      );
    });
  });

  describe('Inventory Use Cases & Repository', () => {
    test('executes Create with idempotency key and enforces unique warehouse/sku per tenant', async () => {
      const repo = new InventoryPgRepository(mockDb);
      const createUseCase = new CreateInventoryUseCase(repo);

      const dto = {
        warehouseId: 'wh-south-1',
        skuId: 'sku-snk-002',
        quantityAvailable: 50,
        reorderLevel: 10,
      };

      // Create initial
      const i1 = await createUseCase.execute(principal, dto, 'key-inv-101');
      assert.strictEqual(i1.quantityAvailable, 50);

      // Idempotent retry
      const i2 = await createUseCase.execute(principal, dto, 'key-inv-101');
      assert.strictEqual(i2.id, i1.id);

      // Duplicate record error
      await assert.rejects(
        () => createUseCase.execute(principal, dto),
        /Inventory record for warehouse wh-south-1 and SKU sku-snk-002 already exists/
      );
    });

    test('executes Get, Update status, and List use cases with optimistic locking', async () => {
      const repo = new InventoryPgRepository(mockDb);
      const createUseCase = new CreateInventoryUseCase(repo);
      const getUseCase = new GetInventoryUseCase(repo);
      const updateUseCase = new UpdateInventoryUseCase(repo);
      const listUseCase = new ListInventoriesUseCase(repo);

      const created = await createUseCase.execute(principal, {
        warehouseId: 'wh-east-1',
        skuId: 'sku-dai-003',
        quantityAvailable: 200,
        reorderLevel: 15,
      });

      // Get
      const fetched = await getUseCase.execute(principal, created.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.warehouseId, 'wh-east-1');

      // List
      const list = await listUseCase.execute(principal, { warehouseId: 'wh-east-1' });
      assert.strictEqual(list.total, 1);

      // Optimistic Concurrency Failure
      await assert.rejects(
        () => updateUseCase.execute(principal, created.id, { quantityAvailable: 250, version: 999 }),
        /Optimistic locking failure/
      );

      // Update Inventory Success
      const updated = await updateUseCase.execute(principal, created.id, {
        quantityAvailable: 250,
        version: 1,
      });
      assert.strictEqual(updated.quantityAvailable, 250);
      assert.strictEqual(updated.version, 2);
    });
  });
});
