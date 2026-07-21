import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { CreditLimit } from './domain/entities/credit-limit.js';
import { CreditLimitPgRepository } from './infrastructure/database/repositories/credit-limit.pg-repository.js';
import { CreateCreditLimitUseCase } from './application/usecases/credit-limit/create-credit-limit.usecase.js';
import { GetCreditLimitUseCase } from './application/usecases/credit-limit/get-credit-limit.usecase.js';
import { UpdateCreditLimitUseCase } from './application/usecases/credit-limit/update-credit-limit.usecase.js';
import { ListCreditLimitsUseCase } from './application/usecases/credit-limit/list-credit-limits.usecase.js';
import { CreditLimitProjectionHandler } from './application/handlers/credit_limit_projection.handler.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('CreditLimit Full Vertical Slice Unit & Repo Tests', () => {
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
    CreditLimitPgRepository.clearStore();
    CreditLimitProjectionHandler.clearDedupeStore();
  });

  describe('CreditLimit Domain Aggregate Invariants', () => {
    test('computes available credit, utilization percentage, and credit hold (>90%)', () => {
      const cl = CreditLimit.create({
        id: randomUUID(),
        tenantId,
        distributorId: randomUUID(),
        creditLimit: 100000, // $1,000.00
      });

      assert.strictEqual(cl.availableAmount, 100000);
      assert.strictEqual(cl.utilizationPercentage, 0);
      assert.strictEqual(cl.isOnCreditHold, false);

      cl.utilize(80000); // 80% utilization
      assert.strictEqual(cl.availableAmount, 20000);
      assert.strictEqual(cl.utilizationPercentage, 80);
      assert.strictEqual(cl.isOnCreditHold, false);

      cl.utilize(15000); // 95% utilization
      assert.strictEqual(cl.availableAmount, 5000);
      assert.strictEqual(cl.utilizationPercentage, 95);
      assert.strictEqual(cl.isOnCreditHold, true);

      // Rejection when requested amount exceeds available credit
      assert.throws(
        () => cl.utilize(10000),
        /Insufficient credit/
      );
    });

    test('handles temporary limit increase and expiry calculations', () => {
      const cl = CreditLimit.create({
        id: randomUUID(),
        tenantId,
        distributorId: randomUUID(),
        creditLimit: 50000,
      });

      const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      cl.setTemporaryIncrease(20000, tomorrow);
      assert.strictEqual(cl.availableAmount, 70000); // 50k base + 20k temp

      cl.clearTemporaryIncrease();
      assert.strictEqual(cl.availableAmount, 50000);
    });
  });

  describe('CreditLimit Use Cases & Repository', () => {
    test('executes Create with idempotency key and rejects duplicate distributor credit limit', async () => {
      const repo = new CreditLimitPgRepository(mockDb);
      const createUseCase = new CreateCreditLimitUseCase(repo);

      const distId = randomUUID();
      const dto = {
        distributorId: distId,
        creditLimit: 200000,
        creditRating: 'A' as const,
      };

      // Create initial
      const cl1 = await createUseCase.execute(principal, dto, 'key-cl-101');
      assert.strictEqual(cl1.creditLimit, 200000);

      // Idempotent retry
      const cl2 = await createUseCase.execute(principal, dto, 'key-cl-101');
      assert.strictEqual(cl2.id, cl1.id);

      // Duplicate distributor error
      await assert.rejects(
        () => createUseCase.execute(principal, dto),
        /Credit limit already configured for distributor/
      );
    });

    test('executes Get, Update, and List use cases with optimistic locking', async () => {
      const repo = new CreditLimitPgRepository(mockDb);
      const createUseCase = new CreateCreditLimitUseCase(repo);
      const getUseCase = new GetCreditLimitUseCase(repo);
      const updateUseCase = new UpdateCreditLimitUseCase(repo);
      const listUseCase = new ListCreditLimitsUseCase(repo);

      const distId = randomUUID();
      const created = await createUseCase.execute(principal, {
        distributorId: distId,
        creditLimit: 150000,
      });

      // Get
      const fetched = await getUseCase.execute(principal, created.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.creditLimit, 150000);

      // List
      const list = await listUseCase.execute(principal, { distributorId: distId });
      assert.strictEqual(list.total, 1);

      // Optimistic Locking Failure
      await assert.rejects(
        () => updateUseCase.execute(principal, created.id, { creditLimit: 180000, version: 999 }),
        /Optimistic locking failure/
      );

      // Update Credit Limit Success
      const updated = await updateUseCase.execute(principal, created.id, { creditLimit: 180000, version: 1 });
      assert.strictEqual(updated.creditLimit, 180000);
      assert.strictEqual(updated.version, 2);
    });

    test('Projection handler dedupes event processing', async () => {
      const repo = new CreditLimitPgRepository(mockDb);
      const handler = new CreditLimitProjectionHandler(repo);

      const event = {
        eventId: 'evt-cl-999',
        tenantId,
        type: 'distributor.credit_limit.utilized',
        payload: { creditLimitId: randomUUID(), amount: 5000 },
      };

      const res1 = await handler.handleEvent(event);
      assert.strictEqual(res1.handled, true);
      assert.strictEqual(res1.skipped, false);

      const res2 = await handler.handleEvent(event);
      assert.strictEqual(res2.handled, false);
      assert.strictEqual(res2.skipped, true);
    });
  });
});
