import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Sku } from './domain/entities/sku.js';
import { SkuPgRepository } from './infrastructure/database/repositories/sku.pg-repository.js';
import { CreateSkuUseCase } from './application/usecases/sku/create-sku.usecase.js';
import { GetSkuUseCase } from './application/usecases/sku/get-sku.usecase.js';
import { UpdateSkuUseCase } from './application/usecases/sku/update-sku.usecase.js';
import { ListSkusUseCase } from './application/usecases/sku/list-skus.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('SKU Full Vertical Slice Unit & Repo Tests', () => {
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
    SkuPgRepository.clearStore();
  });

  describe('SKU Domain Aggregate Invariants', () => {
    test('validates pricing in cents and prevents negative unitPrice', () => {
      const skuItem = Sku.create({
        id: randomUUID(),
        tenantId,
        code: 'SKU-COLA-500ML',
        name: 'Sparkling Cola 500ml Bottle',
        unitPrice: 1500, // $15.00 in cents
      });

      assert.strictEqual(skuItem.unitPrice, 1500);
      assert.strictEqual(skuItem.status, 'ACTIVE');

      skuItem.deactivate();
      assert.strictEqual(skuItem.status, 'INACTIVE');

      // Negative unitPrice guard clause error
      assert.throws(
        () => skuItem.updateDetails({ unitPrice: -500 }),
        /unitPrice cannot be negative/
      );
    });
  });

  describe('SKU Use Cases & Repository', () => {
    test('executes Create with idempotency key and enforces unique Code per tenant', async () => {
      const repo = new SkuPgRepository(mockDb);
      const createUseCase = new CreateSkuUseCase(repo);

      const dto = {
        code: 'SKU-CHIPS-100G',
        name: 'Crispy Potato Chips Pack',
        unitPrice: 250,
      };

      // Create initial
      const s1 = await createUseCase.execute(principal, dto, 'key-sku-101');
      assert.strictEqual(s1.code, 'SKU-CHIPS-100G');

      // Idempotent retry
      const s2 = await createUseCase.execute(principal, dto, 'key-sku-101');
      assert.strictEqual(s2.id, s1.id);

      // Duplicate Code error
      await assert.rejects(
        () => createUseCase.execute(principal, dto),
        /SKU Code SKU-CHIPS-100G already exists/
      );
    });

    test('executes Get, Update status, and List use cases with optimistic locking', async () => {
      const repo = new SkuPgRepository(mockDb);
      const createUseCase = new CreateSkuUseCase(repo);
      const getUseCase = new GetSkuUseCase(repo);
      const updateUseCase = new UpdateSkuUseCase(repo);
      const listUseCase = new ListSkusUseCase(repo);

      const created = await createUseCase.execute(principal, {
        code: 'SKU-MILK-1L',
        name: 'Fresh Dairy Milk 1L Carton',
        unitPrice: 400,
      });

      // Get
      const fetched = await getUseCase.execute(principal, created.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.code, 'SKU-MILK-1L');

      // List
      const list = await listUseCase.execute(principal, { code: 'SKU-MILK-1L' });
      assert.strictEqual(list.total, 1);

      // Optimistic Concurrency Failure
      await assert.rejects(
        () => updateUseCase.execute(principal, created.id, { unitPrice: 450, version: 999 }),
        /Optimistic locking failure/
      );

      // Update SKU Success
      const updated = await updateUseCase.execute(principal, created.id, {
        unitPrice: 450,
        version: 1,
      });
      assert.strictEqual(updated.unitPrice, 450);
      assert.strictEqual(updated.version, 2);
    });
  });
});
