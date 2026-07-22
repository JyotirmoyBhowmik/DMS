import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Discount } from './domain/entities/discount.js';
import { DiscountPgRepository } from './infrastructure/database/repositories/discount.pg-repository.js';
import { CreateDiscountUseCase } from './application/usecases/create-discount.usecase.js';
import { GetDiscountUseCase } from './application/usecases/get-discount.usecase.js';
import { UpdateDiscountUseCase } from './application/usecases/update-discount.usecase.js';
import { ListDiscountsUseCase } from './application/usecases/list-discounts.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('Discount Full Vertical Slice Unit & Repo Tests', () => {
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
    DiscountPgRepository.clearStore();
  });

  describe('Discount Domain Aggregate Invariants', () => {
    test('validates value range and state machine transitions', () => {
      // Invalid discount value guard clause
      assert.throws(
        () => new Discount({
          id: randomUUID(),
          tenantId,
          name: 'Invalid Promo',
          code: 'DISC-INVALID',
          value: -10,
        }),
        /Discount value must be positive/
      );

      const discount = Discount.create({
        id: randomUUID(),
        tenantId,
        name: 'Festive Season Promo',
        code: 'DISC-FESTIVE-15',
        discountType: 'PERCENTAGE',
        value: 15,
        minOrderAmountCents: 5000,
      });

      assert.strictEqual(discount.status, 'DRAFT');

      // Valid state transition: DRAFT -> ACTIVE -> EXPIRED -> ARCHIVED
      discount.updateStatus('ACTIVE');
      assert.strictEqual(discount.status, 'ACTIVE');

      discount.updateStatus('EXPIRED');
      assert.strictEqual(discount.status, 'EXPIRED');

      discount.updateStatus('ARCHIVED');
      assert.strictEqual(discount.status, 'ARCHIVED');

      // Illegal transition after ARCHIVED
      assert.throws(
        () => discount.updateStatus('ACTIVE'),
        /Cannot transition from final status/
      );
    });
  });

  describe('Discount Use Cases & Repository', () => {
    test('executes Create with idempotency key and enforces unique code per tenant', async () => {
      const repo = new DiscountPgRepository(mockDb);
      const createUseCase = new CreateDiscountUseCase(repo);
      const getUseCase = new GetDiscountUseCase(repo);
      const updateUseCase = new UpdateDiscountUseCase(repo);
      const listUseCase = new ListDiscountsUseCase(repo);

      const dto = {
        name: 'Monsoon Bulk Discount',
        code: 'DISC-MONSOON-500',
        discountType: 'FLAT_AMOUNT' as const,
        value: 500,
        minOrderAmountCents: 10000,
      };

      // Create initial
      const d1 = await createUseCase.execute(principal, dto, 'key-disc-101');
      assert.strictEqual(d1.code, 'DISC-MONSOON-500');

      // Idempotent retry
      const d2 = await createUseCase.execute(principal, dto, 'key-disc-101');
      assert.strictEqual(d2.id, d1.id);

      // Duplicate record error
      await assert.rejects(
        () => createUseCase.execute(principal, dto),
        /Discount with code DISC-MONSOON-500 already exists/
      );

      // Get
      const fetched = await getUseCase.execute(principal, d1.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.name, 'Monsoon Bulk Discount');

      // List
      const list = await listUseCase.execute(principal, { code: 'DISC-MONSOON-500' });
      assert.strictEqual(list.total, 1);

      // Update status
      const updated = await updateUseCase.execute(principal, d1.id, {
        status: 'ACTIVE',
        version: 1,
      });
      assert.strictEqual(updated.status, 'ACTIVE');
      assert.strictEqual(updated.version, 2);
    });
  });
});
