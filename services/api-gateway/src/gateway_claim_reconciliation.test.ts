import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ClaimReconciliationController } from '../../claims-service/src/presentation/rest/controllers/claim_reconciliation.controller.js';
import { ClaimReconciliationPgRepository } from '../../claims-service/src/infrastructure/database/repositories/claim_reconciliation.pg-repository.js';
import { randomUUID } from 'node:crypto';

describe('Gateway ClaimReconciliation Integration Tests', () => {
  const repository = new ClaimReconciliationPgRepository();
  const controller = new ClaimReconciliationController(repository);

  const mockHeaders = {
    'x-tenant-id': randomUUID(),
    'x-user-id': 'admin-user',
    'x-user-roles': 'admin',
  };

  it('handles create, get, update, and list via REST controller', async () => {
    ClaimReconciliationPgRepository.clearStore();

    const createRes: any = await controller.handleCreate(
      {
        reconciliationCode: 'REC-GW-001',
        distributorId: randomUUID(),
        totalClaimedCents: 350000,
      },
      mockHeaders
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const id = createRes.body.reconciliation.id;

    const getRes: any = await controller.handleGet(id, mockHeaders);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual(getRes.body.reconciliation.reconciliationCode, 'REC-GW-001');

    const updateRes: any = await controller.handleUpdate(
      id,
      {
        status: 'IN_PROGRESS',
        version: 1,
      },
      mockHeaders
    );
    assert.strictEqual(updateRes.statusCode, 200);
    assert.strictEqual(updateRes.body.reconciliation.status, 'IN_PROGRESS');

    const listRes: any = await controller.handleList({}, mockHeaders);
    assert.strictEqual(listRes.statusCode, 200);
    assert.strictEqual(listRes.body.total, 1);
  });
});
