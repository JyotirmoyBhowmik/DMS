import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ProductCategory } from './domain/entities/product_category.js';
import { ProductCategoryPgRepository } from './infrastructure/database/repositories/product_category.pg-repository.js';
import { CreateProductCategoryUseCase } from './application/usecases/product_category/create-product-category.usecase.js';
import { GetProductCategoryUseCase } from './application/usecases/product_category/get-product-category.usecase.js';
import { UpdateProductCategoryUseCase } from './application/usecases/product_category/update-product-category.usecase.js';
import { ListProductCategoriesUseCase } from './application/usecases/product_category/list-product-categories.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('ProductCategory Full Vertical Slice Unit & Repo Tests', () => {
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
    ProductCategoryPgRepository.clearStore();
  });

  describe('ProductCategory Domain Aggregate Invariants', () => {
    test('validates category attributes and status transitions', () => {
      const category = ProductCategory.create({
        id: randomUUID(),
        tenantId,
        code: 'CAT-BEV',
        name: 'Beverages',
        description: 'All liquid beverages and soft drinks',
      });

      assert.strictEqual(category.code, 'CAT-BEV');
      assert.strictEqual(category.status, 'ACTIVE');

      category.deactivate();
      assert.strictEqual(category.status, 'INACTIVE');
    });
  });

  describe('ProductCategory Use Cases & Repository', () => {
    test('executes Create with idempotency key and enforces unique Code per tenant', async () => {
      const repo = new ProductCategoryPgRepository(mockDb);
      const createUseCase = new CreateProductCategoryUseCase(repo);

      const dto = {
        code: 'CAT-SNK',
        name: 'Snacks & Confectionery',
        description: 'Chips, biscuits, chocolates',
      };

      // Create initial
      const c1 = await createUseCase.execute(principal, dto, 'key-cat-101');
      assert.strictEqual(c1.code, 'CAT-SNK');

      // Idempotent retry
      const c2 = await createUseCase.execute(principal, dto, 'key-cat-101');
      assert.strictEqual(c2.id, c1.id);

      // Duplicate Code error
      await assert.rejects(
        () => createUseCase.execute(principal, dto),
        /Category Code CAT-SNK already exists/
      );
    });

    test('executes Get, Update status, and List use cases with optimistic locking', async () => {
      const repo = new ProductCategoryPgRepository(mockDb);
      const createUseCase = new CreateProductCategoryUseCase(repo);
      const getUseCase = new GetProductCategoryUseCase(repo);
      const updateUseCase = new UpdateProductCategoryUseCase(repo);
      const listUseCase = new ListProductCategoriesUseCase(repo);

      const created = await createUseCase.execute(principal, {
        code: 'CAT-DAI',
        name: 'Dairy Products',
        description: 'Milk, cheese, butter',
      });

      // Get
      const fetched = await getUseCase.execute(principal, created.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.code, 'CAT-DAI');

      // List
      const list = await listUseCase.execute(principal, { code: 'CAT-DAI' });
      assert.strictEqual(list.total, 1);

      // Optimistic Concurrency Failure
      await assert.rejects(
        () => updateUseCase.execute(principal, created.id, { name: 'Fresh Dairy Products', version: 999 }),
        /Optimistic locking failure/
      );

      // Update Category Success
      const updated = await updateUseCase.execute(principal, created.id, {
        name: 'Fresh Dairy Products',
        version: 1,
      });
      assert.strictEqual(updated.name, 'Fresh Dairy Products');
      assert.strictEqual(updated.version, 2);
    });
  });
});
