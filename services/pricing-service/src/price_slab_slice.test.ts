import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { PriceSlab } from './domain/entities/price_slab.js';
import { PriceSlabPgRepository } from './infrastructure/database/repositories/price_slab.pg-repository.js';
import { CreatePriceSlabUseCase } from './application/usecases/create-price-slab.usecase.js';
import { GetPriceSlabUseCase } from './application/usecases/get-price-slab.usecase.js';
import { UpdatePriceSlabUseCase } from './application/usecases/update-price-slab.usecase.js';
import { ListPriceSlabsUseCase } from './application/usecases/list-price-slabs.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('PriceSlab Full Vertical Slice Unit & Repo Tests', () => {
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
    PriceSlabPgRepository.clearStore();
  });

  describe('PriceSlab Domain Aggregate Invariants', () => {
    test('validates minQuantity/maxQuantity range and state machine transitions', () => {
      // Invalid quantity range guard clause
      assert.throws(
        () => new PriceSlab({
          id: randomUUID(),
          tenantId,
          priceListId: 'pl-01',
          skuId: 'sku-01',
          minQuantity: 100,
          maxQuantity: 10,
          priceCents: 500,
        }),
        /maxQuantity cannot be less than minQuantity/
      );

      const slab = PriceSlab.create({
        id: randomUUID(),
        tenantId,
        priceListId: 'pl-wholesale',
        skuId: 'sku-bulk-item',
        minQuantity: 50,
        maxQuantity: 200,
        priceCents: 1500,
      });

      assert.strictEqual(slab.status, 'ACTIVE');

      // State transition: ACTIVE -> INACTIVE
      slab.updateStatus('INACTIVE');
      assert.strictEqual(slab.status, 'INACTIVE');
    });
  });

  describe('PriceSlab Use Cases & Repository', () => {
    test('executes Create with idempotency key and lists price slabs by priceListId', async () => {
      const repo = new PriceSlabPgRepository(mockDb);
      const createUseCase = new CreatePriceSlabUseCase(repo);
      const getUseCase = new GetPriceSlabUseCase(repo);
      const updateUseCase = new UpdatePriceSlabUseCase(repo);
      const listUseCase = new ListPriceSlabsUseCase(repo);

      const dto = {
        priceListId: 'pl-tier-1',
        skuId: 'sku-item-100',
        minQuantity: 10,
        maxQuantity: 49,
        priceCents: 1800,
      };

      // Create initial
      const s1 = await createUseCase.execute(principal, dto, 'key-pslab-101');
      assert.strictEqual(s1.priceListId, 'pl-tier-1');

      // Idempotent retry
      const s2 = await createUseCase.execute(principal, dto, 'key-pslab-101');
      assert.strictEqual(s2.id, s1.id);

      // Get
      const fetched = await getUseCase.execute(principal, s1.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.skuId, 'sku-item-100');

      // List
      const list = await listUseCase.execute(principal, { priceListId: 'pl-tier-1' });
      assert.strictEqual(list.total, 1);

      // Update status
      const updated = await updateUseCase.execute(principal, s1.id, {
        status: 'INACTIVE',
        version: 1,
      });
      assert.strictEqual(updated.status, 'INACTIVE');
      assert.strictEqual(updated.version, 2);
    });
  });
});
