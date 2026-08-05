import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ChannelPriceRule } from './domain/entities/channel_price_rule.js';
import { ChannelPriceRulePgRepository } from './infrastructure/database/repositories/channel_price_rule.pg-repository.js';
import { CreateChannelPriceRuleUseCase } from './application/usecases/create-channel-price-rule.usecase.js';
import { GetChannelPriceRuleUseCase } from './application/usecases/get-channel-price-rule.usecase.js';
import { UpdateChannelPriceRuleUseCase } from './application/usecases/update-channel-price-rule.usecase.js';
import { ListChannelPriceRulesUseCase } from './application/usecases/list-channel-price-rules.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('ChannelPriceRule Full Vertical Slice Unit & Repo Tests', () => {
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
    ChannelPriceRulePgRepository.clearStore();
  });

  describe('ChannelPriceRule Domain Aggregate Invariants', () => {
    test('validates multiplier range and state machine transitions', () => {
      // Invalid multiplier guard clause
      assert.throws(
        () => new ChannelPriceRule({
          id: randomUUID(),
          tenantId,
          priceListId: 'pl-01',
          channelCode: 'GT',
          multiplier: -0.2,
        }),
        /multiplier must be positive/
      );

      const rule = ChannelPriceRule.create({
        id: randomUUID(),
        tenantId,
        priceListId: 'pl-retail',
        channelCode: 'ECOM',
        multiplier: 0.90,
        priceAdjustmentCents: -50,
      });

      assert.strictEqual(rule.status, 'ACTIVE');

      // State transition: ACTIVE -> INACTIVE
      rule.updateStatus('INACTIVE');
      assert.strictEqual(rule.status, 'INACTIVE');
    });
  });

  describe('ChannelPriceRule Use Cases & Repository', () => {
    test('executes Create with idempotency key and enforces unique channel per price list', async () => {
      const repo = new ChannelPriceRulePgRepository(mockDb);
      const createUseCase = new CreateChannelPriceRuleUseCase(repo);
      const getUseCase = new GetChannelPriceRuleUseCase(repo);
      const updateUseCase = new UpdateChannelPriceRuleUseCase(repo);
      const listUseCase = new ListChannelPriceRulesUseCase(repo);

      const dto = {
        priceListId: 'pl-tier-channel',
        channelCode: 'MT' as const,
        multiplier: 0.95,
        priceAdjustmentCents: 0,
      };

      // Create initial
      const r1 = await createUseCase.execute(principal, dto, 'key-chanrule-101');
      assert.strictEqual(r1.channelCode, 'MT');

      // Idempotent retry
      const r2 = await createUseCase.execute(principal, dto, 'key-chanrule-101');
      assert.strictEqual(r2.id, r1.id);

      // Duplicate record error
      await assert.rejects(
        () => createUseCase.execute(principal, dto),
        /Channel price rule for channel MT already exists/
      );

      // Get
      const fetched = await getUseCase.execute(principal, r1.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.channelCode, 'MT');

      // List
      const list = await listUseCase.execute(principal, { channelCode: 'MT' });
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
