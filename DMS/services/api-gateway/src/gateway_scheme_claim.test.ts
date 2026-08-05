import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SchemeClaimController } from '../../claims-service/src/presentation/rest/controllers/scheme_claim.controller.js';
import { SchemeClaimPgRepository } from '../../claims-service/src/infrastructure/database/repositories/scheme_claim.pg-repository.js';
import { randomUUID } from 'node:crypto';

describe('Gateway SchemeClaim Integration Tests', () => {
  const repository = new SchemeClaimPgRepository();
  const controller = new SchemeClaimController(repository);

  const mockHeaders = {
    'x-tenant-id': randomUUID(),
    'x-user-id': 'admin-user',
    'x-user-roles': 'admin',
  };

  it('handles create, get, update, and list via REST controller', async () => {
    SchemeClaimPgRepository.clearStore();

    const createRes: any = await controller.handleCreate(
      {
        claimCode: 'SCH-GW-001',
        schemeId: randomUUID(),
        distributorId: randomUUID(),
        claimAmountCents: 75000,
      },
      mockHeaders
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const claimId = createRes.body.claim.id;

    const getRes: any = await controller.handleGet(claimId, mockHeaders);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual(getRes.body.claim.claimCode, 'SCH-GW-001');

    const updateRes: any = await controller.handleUpdate(
      claimId,
      {
        status: 'UNDER_REVIEW',
        version: 1,
      },
      mockHeaders
    );
    assert.strictEqual(updateRes.statusCode, 200);
    assert.strictEqual(updateRes.body.claim.status, 'UNDER_REVIEW');

    const listRes: any = await controller.handleList({}, mockHeaders);
    assert.strictEqual(listRes.statusCode, 200);
    assert.strictEqual(listRes.body.total, 1);
  });
});
