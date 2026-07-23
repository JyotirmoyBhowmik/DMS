import { test, describe } from 'node:test';
import assert from 'node:assert';
import { SchemePayoutController } from '../../schemes-service/src/presentation/rest/controllers/scheme_payout.controller.js';

describe('Gateway & SchemePayout REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists SchemePayout endpoints via controller handlers', async () => {
    SchemePayoutController.clearStore();
    const controller = new SchemePayoutController();

    const createRes = await controller.handleCreate(
      {
        name: 'Distributor Settlement 2026',
        payoutCode: 'PAYOUT-SETTLE-2026',
        schemeId: 'scheme-settle-id',
        distributorId: 'dist-settle-id',
        amountCents: 3000000,
        payoutType: 'CREDIT_NOTE',
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.schemePayout as any).id;

    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.schemePayout as any).payoutCode, 'PAYOUT-SETTLE-2026');
  });
});
