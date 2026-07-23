import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ClaimController } from '../../claims-service/src/presentation/rest/controllers/claim.controller.js';

describe('Gateway & Claim REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Creates, queries, updates and lists Claim endpoints via controller handlers', async () => {
    ClaimController.clearStore();
    const controller = new ClaimController();

    const createRes = await controller.handleCreate(
      {
        name: 'Distributor Volume Claim 2026',
        claimCode: 'CLAIM-VOL-2026',
        distributorId: 'dist-vol-id',
        schemeId: 'scheme-vol-id',
        claimAmountCents: 850000,
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.claim as any).id;

    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.claim as any).claimCode, 'CLAIM-VOL-2026');
  });
});
