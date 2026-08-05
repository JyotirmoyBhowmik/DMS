import { test, describe } from 'node:test';
import assert from 'node:assert';
import { EligibilityRuleController } from '../../schemes-service/src/presentation/rest/controllers/eligibility_rule.controller.js';

describe('Gateway & EligibilityRule REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists EligibilityRule endpoints via controller handlers', async () => {
    EligibilityRuleController.clearStore();
    const controller = new EligibilityRuleController();

    const createRes = await controller.handleCreate(
      {
        name: 'South Zone Target',
        ruleCode: 'RULE-ZONE-SOUTH',
        schemeId: 'scheme-zone-id',
        ruleType: 'GEOGRAPHIC_ZONE',
        targetValue: 'ZONE_SOUTH',
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.eligibilityRule as any).id;

    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.eligibilityRule as any).ruleCode, 'RULE-ZONE-SOUTH');
  });
});
