import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Product } from './domain/entities/product.js';
import { ProductPgRepository } from './infrastructure/database/repositories/product.pg-repository.js';
import { CreateProductUseCase } from './application/usecases/product/create-product.usecase.js';
import { GetProductUseCase } from './application/usecases/product/get-product.usecase.js';
import { UpdateProductUseCase } from './application/usecases/product/update-product.usecase.js';
import { ListProductsUseCase } from './application/usecases/product/list-products.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('Product Full Vertical Slice Unit & Repo Tests', () => {
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
    ProductPgRepository.clearStore();
  });

  describe('Product Domain Aggregate Invariants', () => {
    test('validates pricing in cents and prevents negative thresholds', () => {
      const product = Product.create({
        id: randomUUID(),
        tenantId,
        sku: 'BEV-COLA-500ML',
        name: 'Sparkling Cola 500ml',
        category: 'Beverages',
        price: 1500, // $15.00 in cents
        minThreshold: 20,
      });

      assert.strictEqual(product.price, 1500);
      assert.strictEqual(product.status, 'ACTIVE');

      product.discontinue();
      assert.strictEqual(product.status, 'DISCONTINUED');

      // Negative price guard clause error
      assert.throws(
        () => product.updateDetails({ price: -500 }),
        /Price cannot be negative/
      );
    });
  });

  describe('Product Use Cases & Repository', () => {
    test('executes Create with idempotency key and enforces unique SKU per tenant', async () => {
      const repo = new ProductPgRepository(mockDb);
      const createUseCase = new CreateProductUseCase(repo);

      const dto = {
        sku: 'SNK-CHIPS-100G',
        name: 'Crispy Potato Chips',
        category: 'Snacks',
        price: 250,
        minThreshold: 50,
      };

      // Create initial
      const p1 = await createUseCase.execute(principal, dto, 'key-prod-101');
      assert.strictEqual(p1.sku, 'SNK-CHIPS-100G');

      // Idempotent retry
      const p2 = await createUseCase.execute(principal, dto, 'key-prod-101');
      assert.strictEqual(p2.id, p1.id);

      // Duplicate SKU error
      await assert.rejects(
        () => createUseCase.execute(principal, dto),
        /Product SKU SNK-CHIPS-100G already exists/
      );
    });

    test('executes Get, Update status, and List use cases with optimistic locking', async () => {
      const repo = new ProductPgRepository(mockDb);
      const createUseCase = new CreateProductUseCase(repo);
      const getUseCase = new GetProductUseCase(repo);
      const updateUseCase = new UpdateProductUseCase(repo);
      const listUseCase = new ListProductsUseCase(repo);

      const created = await createUseCase.execute(principal, {
        sku: 'DAI-MILK-1L',
        name: 'Fresh Dairy Milk 1L',
        category: 'Dairy',
        price: 400,
        minThreshold: 15,
      });

      // Get
      const fetched = await getUseCase.execute(principal, created.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.sku, 'DAI-MILK-1L');

      // List
      const list = await listUseCase.execute(principal, { category: 'Dairy' });
      assert.strictEqual(list.total, 1);

      // Optimistic Concurrency Failure
      await assert.rejects(
        () => updateUseCase.execute(principal, created.id, { price: 450, version: 999 }),
        /Optimistic locking failure/
      );

      // Update Product Success
      const updated = await updateUseCase.execute(principal, created.id, {
        price: 450,
        version: 1,
      });
      assert.strictEqual(updated.price, 450);
      assert.strictEqual(updated.version, 2);
    });
  });
});
