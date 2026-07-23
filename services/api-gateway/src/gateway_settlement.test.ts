import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SettlementController } from '../../claims-service/src/presentation/rest/controllers/settlement.controller.js';
import { SettlementPgRepository } from '../../claims-service/src/infrastructure/database/repositories/settlement.pg-repository.js';
import { randomUUID } from 'node:crypto';

describe('Gateway Settlement Integration Tests', () => {
  const repository = new SettlementPgRepository();
  const controller = new SettlementController(repository);

  const mockHeaders = {
    'x-tenant-id': randomUUID(),
    'x-user-id': 'admin-user',
    'x-user-roles': 'admin',
  };

  it('handles create, get, update, and list via REST controller', async () => {
    SettlementPgRepository.clearStore();

    const createRes: any = await controller.handleCreate(
      {
        settlementCode: 'SET-GW-001',
        claimId: randomUUID(),
        distributorId: randomUUID(),
        amountCents: 450000,
      },
      mockHeaders
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const id = createRes.body.settlement.id;

    const getRes: any = await controller.handleGet(id, mockHeaders);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual(getRes.body.settlement.settlementCode, 'SET-GW-001');

    const updateRes: any = await controller.handleUpdate(
      id,
      {
        status: 'PROCESSING',
        version: 1,
      },
      mockHeaders
    );
    assert.strictEqual(updateRes.statusCode, 200);
    assert.strictEqual(updateRes.body.settlement.status, 'PROCESSING');

    const listRes: any = await controller.handleList({}, mockHeaders);
    assert.strictEqual(listRes.statusCode, 200);
    assert.strictEqual(listRes.body.total, 1);
  });
});
