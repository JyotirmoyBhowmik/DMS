import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { SchemeBudget } from './domain/entities/scheme_budget.js';
import { SchemeBudgetPgRepository } from './infrastructure/database/repositories/scheme_budget.pg-repository.js';
import { CreateSchemeBudgetUseCase } from './application/usecases/create-scheme-budget.usecase.js';
import { GetSchemeBudgetUseCase } from './application/usecases/get-scheme-budget.usecase.js';
import { UpdateSchemeBudgetUseCase } from './application/usecases/update-scheme-budget.usecase.js';
import { ListSchemeBudgetsUseCase } from './application/usecases/list-scheme-budgets.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('SchemeBudget Full Vertical Slice Unit & Repo Tests', () => {
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
    SchemeBudgetPgRepository.clearStore();
  });

  describe('SchemeBudget Domain Aggregate Invariants', () => {
    test('validates totalAllocatedCents range, utilization limits, and state machine transitions', () => {
      // Invalid total allocated guard clause
      assert.throws(
        () => new SchemeBudget({
          id: randomUUID(),
          tenantId,
          schemeId: randomUUID(),
          name: 'Invalid Budget',
          budgetCode: 'BUDGET-INVALID',
          totalAllocatedCents: -50000,
        }),
        /totalAllocatedCents must be non-negative/
      );

      // Invalid utilization exceeding total budget
      assert.throws(
        () => new SchemeBudget({
          id: randomUUID(),
          tenantId,
          schemeId: randomUUID(),
          name: 'Excess Utilization',
          budgetCode: 'BUDGET-EXCESS',
          totalAllocatedCents: 100000,
          utilizedCents: 150000,
        }),
        /utilizedCents must be between 0 and totalAllocatedCents/
      );

      const budget = SchemeBudget.create({
        id: randomUUID(),
        tenantId,
        schemeId: randomUUID(),
        name: 'Q1 Trade Budget',
        budgetCode: 'BUDGET-Q1-2026',
        totalAllocatedCents: 1000000,
        utilizedCents: 500000,
      });

      assert.strictEqual(budget.status, 'ACTIVE');
      assert.strictEqual(budget.remainingCents, 500000);

      // Record utilization up to total
      budget.recordUtilization(500000);
      assert.strictEqual(budget.utilizedCents, 1000000);
      assert.strictEqual(budget.remainingCents, 0);
      assert.strictEqual(budget.status, 'EXHAUSTED');

      // State transition: EXHAUSTED -> CLOSED
      budget.updateStatus('CLOSED');
      assert.strictEqual(budget.status, 'CLOSED');

      // Illegal transition after CLOSED
      assert.throws(
        () => budget.updateStatus('ACTIVE'),
        /Cannot transition from final status CLOSED/
      );
    });
  });

  describe('SchemeBudget Use Cases & Repository', () => {
    test('executes Create with idempotency key and enforces unique budget code per scheme', async () => {
      const repo = new SchemeBudgetPgRepository(mockDb);
      const createUseCase = new CreateSchemeBudgetUseCase(repo);
      const getUseCase = new GetSchemeBudgetUseCase(repo);
      const updateUseCase = new UpdateSchemeBudgetUseCase(repo);
      const listUseCase = new ListSchemeBudgetsUseCase(repo);

      const schemeId = randomUUID();
      const dto = {
        name: 'Festival Promo Fund',
        budgetCode: 'BUDGET-FESTIVAL',
        schemeId,
        totalAllocatedCents: 2000000,
      };

      // Create initial
      const b1 = await createUseCase.execute(principal, dto, 'key-budget-101');
      assert.strictEqual(b1.budgetCode, 'BUDGET-FESTIVAL');

      // Idempotent retry
      const b2 = await createUseCase.execute(principal, dto, 'key-budget-101');
      assert.strictEqual(b2.id, b1.id);

      // Duplicate record error
      await assert.rejects(
        () => createUseCase.execute(principal, dto),
        /SchemeBudget with code BUDGET-FESTIVAL already exists for this scheme/
      );

      // Get
      const fetched = await getUseCase.execute(principal, b1.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.name, 'Festival Promo Fund');

      // List
      const list = await listUseCase.execute(principal, { budgetCode: 'BUDGET-FESTIVAL' });
      assert.strictEqual(list.total, 1);

      // Update utilization
      const updated = await updateUseCase.execute(principal, b1.id, {
        utilizedCents: 1000000,
        version: 1,
      });
      assert.strictEqual(updated.utilizedCents, 1000000);
      assert.strictEqual(updated.version, 2);
    });
  });
});
