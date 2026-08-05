import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { TaxRule } from './domain/entities/tax_rule.js';
import { TaxRulePgRepository } from './infrastructure/database/repositories/tax_rule.pg-repository.js';
import { CreateTaxRuleUseCase } from './application/usecases/create-tax-rule.usecase.js';
import { GetTaxRuleUseCase } from './application/usecases/get-tax-rule.usecase.js';
import { UpdateTaxRuleUseCase } from './application/usecases/update-tax-rule.usecase.js';
import { ListTaxRulesUseCase } from './application/usecases/list-tax-rules.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('TaxRule Full Vertical Slice Unit & Repo Tests', () => {
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
    TaxRulePgRepository.clearStore();
  });

  describe('TaxRule Domain Aggregate Invariants', () => {
    test('validates ratePercentage range and state machine transitions', () => {
      // Invalid ratePercentage guard clause
      assert.throws(
        () => new TaxRule({
          id: randomUUID(),
          tenantId,
          name: 'Invalid GST',
          taxCode: 'GST_18',
          ratePercentage: -5.0,
        }),
        /ratePercentage must be non-negative/
      );

      const rule = TaxRule.create({
        id: randomUUID(),
        tenantId,
        name: 'Standard GST 18%',
        taxCode: 'GST_18',
        ratePercentage: 18.0,
      });

      assert.strictEqual(rule.status, 'ACTIVE');

      // State transition: ACTIVE -> INACTIVE
      rule.updateStatus('INACTIVE');
      assert.strictEqual(rule.status, 'INACTIVE');
    });
  });

  describe('TaxRule Use Cases & Repository', () => {
    test('executes Create with idempotency key and enforces unique tax code per tenant', async () => {
      const repo = new TaxRulePgRepository(mockDb);
      const createUseCase = new CreateTaxRuleUseCase(repo);
      const getUseCase = new GetTaxRuleUseCase(repo);
      const updateUseCase = new UpdateTaxRuleUseCase(repo);
      const listUseCase = new ListTaxRulesUseCase(repo);

      const dto = {
        name: 'Reduced GST 5%',
        taxCode: 'GST_5' as const,
        ratePercentage: 5.0,
      };

      // Create initial
      const r1 = await createUseCase.execute(principal, dto, 'key-taxrule-101');
      assert.strictEqual(r1.taxCode, 'GST_5');

      // Idempotent retry
      const r2 = await createUseCase.execute(principal, dto, 'key-taxrule-101');
      assert.strictEqual(r2.id, r1.id);

      // Duplicate record error
      await assert.rejects(
        () => createUseCase.execute(principal, dto),
        /Tax rule with code GST_5 already exists/
      );

      // Get
      const fetched = await getUseCase.execute(principal, r1.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.name, 'Reduced GST 5%');

      // List
      const list = await listUseCase.execute(principal, { taxCode: 'GST_5' });
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
