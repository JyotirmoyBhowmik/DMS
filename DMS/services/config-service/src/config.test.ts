import { test, describe } from 'node:test';
import assert from 'node:assert';
import { EvaluateFlagUseCase } from './application/usecases/evaluate_flag.usecase.js';
import { UpdateFlagUseCase } from './application/usecases/update_flag.usecase.js';
import { FeatureFlag } from './domain/entities.js';

describe('Feature Flag & Config Service Tests', () => {
  const evaluateUseCase = new EvaluateFlagUseCase();
  const updateUseCase = new UpdateFlagUseCase();

  test('EvaluateFlagUseCase - Boolean strategy', () => {
    const flag: FeatureFlag = {
      key: 'test-bool',
      description: 'Test boolean flag',
      strategy: 'boolean',
      enabled: true,
    };

    assert.strictEqual(evaluateUseCase.execute(flag), true);

    flag.enabled = false;
    assert.strictEqual(evaluateUseCase.execute(flag), false);
  });

  test('EvaluateFlagUseCase - Percentage strategy', () => {
    const flag: FeatureFlag = {
      key: 'test-pct',
      description: 'Test percentage rollout flag',
      strategy: 'percentage',
      enabled: true,
      rolloutPercentage: 30, // 30%
    };

    // Consistent hashing checks
    const userA = { userId: 'user-A' };
    const userB = { userId: 'user-B' };
    const userC = { userId: 'user-C' };

    const resA = evaluateUseCase.execute(flag, userA);
    const resB = evaluateUseCase.execute(flag, userB);
    const resC = evaluateUseCase.execute(flag, userC);

    // Verify it is stateless and consistent
    assert.strictEqual(evaluateUseCase.execute(flag, userA), resA);
    assert.strictEqual(evaluateUseCase.execute(flag, userB), resB);
    assert.strictEqual(evaluateUseCase.execute(flag, userC), resC);
  });

  test('EvaluateFlagUseCase - Gradual strategy with segmentation target rules', () => {
    const flag: FeatureFlag = {
      key: 'test-gradual',
      description: 'Test gradual with target rules flag',
      strategy: 'gradual',
      enabled: true,
      rolloutPercentage: 100, // fully rolled out to the matching segment
      targetRules: [
        {
          attribute: 'role',
          operator: 'eq',
          values: ['agent'],
        },
        {
          attribute: 'region',
          operator: 'in',
          values: ['North', 'West'],
        }
      ]
    };

    // Case 1: Matching role and region
    assert.strictEqual(
      evaluateUseCase.execute(flag, {
        userId: 'agent-1',
        attributes: { role: 'agent', region: 'North' }
      }),
      true
    );

    // Case 2: Matching role, non-matching region
    assert.strictEqual(
      evaluateUseCase.execute(flag, {
        userId: 'agent-2',
        attributes: { role: 'agent', region: 'South' }
      }),
      false
    );

    // Case 3: Non-matching role, matching region
    assert.strictEqual(
      evaluateUseCase.execute(flag, {
        userId: 'mgr-1',
        attributes: { role: 'manager', region: 'North' }
      }),
      false
    );
  });

  test('UpdateFlagUseCase - raises flag.changed.v1', async () => {
    UpdateFlagUseCase.clearAll();
    const tenantId = '00000000-0000-0000-0000-000000000001';
    const correlationId = 'corr-config-9999';

    const result = await updateUseCase.execute(
      {
        tenantId,
        flagKey: 'new-flag',
        enabled: true,
        strategy: 'percentage',
        rolloutPercentage: 50,
      },
      { correlationId }
    );

    assert.strictEqual(result.flag.key, 'new-flag');
    assert.strictEqual(result.flag.enabled, true);
    assert.strictEqual(result.flag.rolloutPercentage, 50);

    const event = result.event;
    assert.strictEqual(event.type, 'flag.changed');
    assert.strictEqual(event.version, 'v1');
    assert.strictEqual(event.tenantId, tenantId);
    assert.strictEqual(event.correlationId, correlationId);
    assert.strictEqual(event.payload.flagKey, 'new-flag');
    assert.strictEqual(event.payload.enabled, true);
  });
});
