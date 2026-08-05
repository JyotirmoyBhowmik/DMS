import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { GeoPriceRule } from './domain/entities/geo_price_rule.js';
import { GeoPriceRulePgRepository } from './infrastructure/database/repositories/geo_price_rule.pg-repository.js';
import { CreateGeoPriceRuleUseCase } from './application/usecases/create-geo-price-rule.usecase.js';
import { GetGeoPriceRuleUseCase } from './application/usecases/get-geo-price-rule.usecase.js';
import { UpdateGeoPriceRuleUseCase } from './application/usecases/update-geo-price-rule.usecase.js';
import { ListGeoPriceRulesUseCase } from './application/usecases/list-geo-price-rules.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('GeoPriceRule Full Vertical Slice Unit & Repo Tests', () => {
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
    GeoPriceRulePgRepository.clearStore();
  });

  describe('GeoPriceRule Domain Aggregate Invariants', () => {
    test('validates multiplier range and state machine transitions', () => {
      // Invalid multiplier guard clause
      assert.throws(
        () => new GeoPriceRule({
          id: randomUUID(),
          tenantId,
          priceListId: 'pl-01',
          regionCode: 'NORTH-EAST',
          multiplier: -0.5,
        }),
        /multiplier must be positive/
      );

      const rule = GeoPriceRule.create({
        id: randomUUID(),
        tenantId,
        priceListId: 'pl-retail',
        regionCode: 'SOUTH-ZONE',
        multiplier: 1.15,
        priceAdjustmentCents: 50,
      });

      assert.strictEqual(rule.status, 'ACTIVE');

      // State transition: ACTIVE -> INACTIVE
      rule.updateStatus('INACTIVE');
      assert.strictEqual(rule.status, 'INACTIVE');
    });
  });

  describe('GeoPriceRule Use Cases & Repository', () => {
    test('executes Create with idempotency key and enforces unique region per price list', async () => {
      const repo = new GeoPriceRulePgRepository(mockDb);
      const createUseCase = new CreateGeoPriceRuleUseCase(repo);
      const getUseCase = new GetGeoPriceRuleUseCase(repo);
      const updateUseCase = new UpdateGeoPriceRuleUseCase(repo);
      const listUseCase = new ListGeoPriceRulesUseCase(repo);

      const dto = {
        priceListId: 'pl-tier-north',
        regionCode: 'DELHI-NCR',
        multiplier: 1.05,
        priceAdjustmentCents: 100,
      };

      // Create initial
      const r1 = await createUseCase.execute(principal, dto, 'key-georule-101');
      assert.strictEqual(r1.regionCode, 'DELHI-NCR');

      // Idempotent retry
      const r2 = await createUseCase.execute(principal, dto, 'key-georule-101');
      assert.strictEqual(r2.id, r1.id);

      // Duplicate record error
      await assert.rejects(
        () => createUseCase.execute(principal, dto),
        /Geo price rule for region DELHI-NCR already exists/
      );

      // Get
      const fetched = await getUseCase.execute(principal, r1.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.regionCode, 'DELHI-NCR');

      // List
      const list = await listUseCase.execute(principal, { regionCode: 'DELHI-NCR' });
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
