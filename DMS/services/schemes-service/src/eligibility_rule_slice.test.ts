import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { EligibilityRule } from './domain/entities/eligibility_rule.js';
import { EligibilityRulePgRepository } from './infrastructure/database/repositories/eligibility_rule.pg-repository.js';
import { CreateEligibilityRuleUseCase } from './application/usecases/create-eligibility-rule.usecase.js';
import { GetEligibilityRuleUseCase } from './application/usecases/get-eligibility-rule.usecase.js';
import { UpdateEligibilityRuleUseCase } from './application/usecases/update-eligibility-rule.usecase.js';
import { ListEligibilityRulesUseCase } from './application/usecases/list-eligibility-rules.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('EligibilityRule Full Vertical Slice Unit & Repo Tests', () => {
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
    EligibilityRulePgRepository.clearStore();
  });

  describe('EligibilityRule Domain Aggregate Invariants', () => {
    test('validates minOrderValueCents range and state machine transitions', () => {
      // Invalid min order value guard clause
      assert.throws(
        () => new EligibilityRule({
          id: randomUUID(),
          tenantId,
          schemeId: randomUUID(),
          name: 'Invalid Min Order',
          ruleCode: 'RULE-INVALID',
          minOrderValueCents: -500,
        }),
        /minOrderValueCents must be non-negative/
      );

      const rule = EligibilityRule.create({
        id: randomUUID(),
        tenantId,
        schemeId: randomUUID(),
        name: 'Min Order 1000 INR',
        ruleCode: 'RULE-MIN-1000',
        ruleType: 'MIN_ORDER_VALUE',
        minOrderValueCents: 100000,
      });

      assert.strictEqual(rule.status, 'ACTIVE');

      // State transition: ACTIVE -> INACTIVE
      rule.updateStatus('INACTIVE');
      assert.strictEqual(rule.status, 'INACTIVE');
    });
  });

  describe('EligibilityRule Use Cases & Repository', () => {
    test('executes Create with idempotency key and enforces unique rule code per scheme', async () => {
      const repo = new EligibilityRulePgRepository(mockDb);
      const createUseCase = new CreateEligibilityRuleUseCase(repo);
      const getUseCase = new GetEligibilityRuleUseCase(repo);
      const updateUseCase = new UpdateEligibilityRuleUseCase(repo);
      const listUseCase = new ListEligibilityRulesUseCase(repo);

      const schemeId = randomUUID();
      const dto = {
        name: 'Tier 1 Outlets Only',
        ruleCode: 'RULE-TIER-1',
        schemeId,
        ruleType: 'CUSTOMER_TIER' as const,
        targetValue: 'TIER_1',
      };

      // Create initial
      const r1 = await createUseCase.execute(principal, dto, 'key-eligibility-101');
      assert.strictEqual(r1.ruleCode, 'RULE-TIER-1');

      // Idempotent retry
      const r2 = await createUseCase.execute(principal, dto, 'key-eligibility-101');
      assert.strictEqual(r2.id, r1.id);

      // Duplicate record error
      await assert.rejects(
        () => createUseCase.execute(principal, dto),
        /EligibilityRule with code RULE-TIER-1 already exists for this scheme/
      );

      // Get
      const fetched = await getUseCase.execute(principal, r1.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.name, 'Tier 1 Outlets Only');

      // List
      const list = await listUseCase.execute(principal, { ruleCode: 'RULE-TIER-1' });
      assert.strictEqual(list.total, 1);

      // Update status
      const updated = await updateUseCase.execute(principal, r1.id, {
        status: 'INACTIVE',
        version: 1,
      });
      assert.strictEqual(updated.status, 'INACTIVE');
      assert.strictEqual(updated.version, 2);
    });
  });
});
