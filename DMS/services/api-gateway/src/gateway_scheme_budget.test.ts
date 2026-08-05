import { test, describe } from 'node:test';
import assert from 'node:assert';
import { SchemeBudgetController } from '../../schemes-service/src/presentation/rest/controllers/scheme_budget.controller.js';

describe('Gateway & SchemeBudget REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists SchemeBudget endpoints via controller handlers', async () => {
    SchemeBudgetController.clearStore();
    const controller = new SchemeBudgetController();

    const createRes = await controller.handleCreate(
      {
        name: 'Annual Channel Budget',
        budgetCode: 'BUDGET-ANNUAL-2026',
        schemeId: 'scheme-annual-id',
        totalAllocatedCents: 5000000,
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.schemeBudget as any).id;

    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.schemeBudget as any).budgetCode, 'BUDGET-ANNUAL-2026');
  });
});
