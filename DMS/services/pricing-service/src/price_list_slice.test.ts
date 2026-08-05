import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { PriceList } from './domain/entities/price_list.js';
import { PriceListPgRepository } from './infrastructure/database/repositories/price_list.pg-repository.js';
import { CreatePriceListUseCase } from './application/usecases/create-price-list.usecase.js';
import { GetPriceListUseCase } from './application/usecases/get-price-list.usecase.js';
import { UpdatePriceListUseCase } from './application/usecases/update-price-list.usecase.js';
import { ListPriceListsUseCase } from './application/usecases/list-price-lists.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('PriceList Full Vertical Slice Unit & Repo Tests', () => {
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
    PriceListPgRepository.clearStore();
  });

  describe('PriceList Domain Aggregate Invariants', () => {
    test('validates validFrom/validTo range and state machine transitions', () => {
      // Invalid date range guard clause
      assert.throws(
        () => new PriceList({
          id: randomUUID(),
          tenantId,
          name: 'Invalid Tier',
          code: 'PL-INVALID',
          validFrom: new Date('2026-12-31'),
          validTo: new Date('2026-01-01'),
        }),
        /validFrom cannot be after validTo/
      );

      const list = PriceList.create({
        id: randomUUID(),
        tenantId,
        name: 'Standard Wholesale Tier',
        code: 'PL-WHOLESALE-2026',
        currency: 'INR',
      });

      assert.strictEqual(list.status, 'DRAFT');

      // Valid state transition: DRAFT -> ACTIVE -> INACTIVE -> ARCHIVED
      list.updateStatus('ACTIVE');
      assert.strictEqual(list.status, 'ACTIVE');

      list.updateStatus('INACTIVE');
      assert.strictEqual(list.status, 'INACTIVE');

      list.updateStatus('ARCHIVED');
      assert.strictEqual(list.status, 'ARCHIVED');

      // Illegal transition after ARCHIVED
      assert.throws(
        () => list.updateStatus('ACTIVE'),
        /Cannot transition from final status/
      );
    });
  });

  describe('PriceList Use Cases & Repository', () => {
    test('executes Create with idempotency key and enforces unique code per tenant', async () => {
      const repo = new PriceListPgRepository(mockDb);
      const createUseCase = new CreatePriceListUseCase(repo);
      const getUseCase = new GetPriceListUseCase(repo);
      const updateUseCase = new UpdatePriceListUseCase(repo);
      const listUseCase = new ListPriceListsUseCase(repo);

      const dto = {
        name: 'Retail Standard Tier',
        code: 'PL-RETAIL-STD',
        currency: 'INR',
      };

      // Create initial
      const l1 = await createUseCase.execute(principal, dto, 'key-pl-101');
      assert.strictEqual(l1.code, 'PL-RETAIL-STD');

      // Idempotent retry
      const l2 = await createUseCase.execute(principal, dto, 'key-pl-101');
      assert.strictEqual(l2.id, l1.id);

      // Duplicate record error
      await assert.rejects(
        () => createUseCase.execute(principal, dto),
        /Price list with code PL-RETAIL-STD already exists/
      );

      // Get
      const fetched = await getUseCase.execute(principal, l1.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.name, 'Retail Standard Tier');

      // List
      const list = await listUseCase.execute(principal, { code: 'PL-RETAIL-STD' });
      assert.strictEqual(list.total, 1);

      // Update status
      const updated = await updateUseCase.execute(principal, l1.id, {
        status: 'ACTIVE',
        version: 1,
      });
      assert.strictEqual(updated.status, 'ACTIVE');
      assert.strictEqual(updated.version, 2);
    });
  });
});
