import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Replacement } from './domain/entities/replacement.js';
import { ReplacementPgRepository } from './infrastructure/database/repositories/replacement.pg-repository.js';
import { CreateReplacementUseCase } from './application/usecases/replacement/create-replacement.usecase.js';
import { GetReplacementUseCase } from './application/usecases/replacement/get-replacement.usecase.js';
import { UpdateReplacementUseCase } from './application/usecases/replacement/update-replacement.usecase.js';
import { ListReplacementsUseCase } from './application/usecases/replacement/list-replacements.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('Replacement Full Vertical Slice Unit & Repo Tests', () => {
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
    ReplacementPgRepository.clearStore();
  });

  describe('Replacement Domain Aggregate Invariants', () => {
    test('validates quantity guard clause and state machine transitions', () => {
      // Non-positive quantity guard clause
      assert.throws(
        () => new Replacement({
          id: randomUUID(),
          tenantId,
          replacementNumber: 'REP-001',
          returnId: 'ret-01',
          outletId: 'outlet-01',
          warehouseId: 'wh-01',
          skuId: 'sku-01',
          quantity: 0,
        }),
        /quantity must be positive/
      );

      const rep = Replacement.create({
        id: randomUUID(),
        tenantId,
        replacementNumber: 'REP-002',
        returnId: 'ret-02',
        outletId: 'outlet-02',
        warehouseId: 'wh-main',
        skuId: 'sku-02',
        quantity: 5,
      });

      assert.strictEqual(rep.status, 'REQUESTED');

      // Valid state transition: REQUESTED -> APPROVED -> DISPATCHED -> DELIVERED
      rep.updateStatus('APPROVED');
      assert.strictEqual(rep.status, 'APPROVED');

      rep.updateStatus('DISPATCHED');
      assert.strictEqual(rep.status, 'DISPATCHED');

      rep.updateStatus('DELIVERED');
      assert.strictEqual(rep.status, 'DELIVERED');

      // Illegal transition after DELIVERED
      assert.throws(
        () => rep.updateStatus('REJECTED'),
        /Cannot transition from final status/
      );
    });
  });

  describe('Replacement Use Cases & Repository', () => {
    test('executes Create with idempotency key and enforces unique replacementNumber per tenant', async () => {
      const repo = new ReplacementPgRepository(mockDb);
      const createUseCase = new CreateReplacementUseCase(repo);
      const getUseCase = new GetReplacementUseCase(repo);
      const updateUseCase = new UpdateReplacementUseCase(repo);
      const listUseCase = new ListReplacementsUseCase(repo);

      const dto = {
        replacementNumber: 'REP-2026-X',
        returnId: 'ret-101',
        outletId: 'outlet-101',
        warehouseId: 'wh-main',
        skuId: 'sku-item-1',
        quantity: 10,
      };

      // Create initial
      const r1 = await createUseCase.execute(principal, dto, 'key-rep-101');
      assert.strictEqual(r1.replacementNumber, 'REP-2026-X');

      // Idempotent retry
      const r2 = await createUseCase.execute(principal, dto, 'key-rep-101');
      assert.strictEqual(r2.id, r1.id);

      // Duplicate record error
      await assert.rejects(
        () => createUseCase.execute(principal, dto),
        /Replacement request with number REP-2026-X already exists/
      );

      // Get
      const fetched = await getUseCase.execute(principal, r1.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.returnId, 'ret-101');

      // List
      const list = await listUseCase.execute(principal, { returnId: 'ret-101' });
      assert.strictEqual(list.total, 1);

      // Update status
      const updated = await updateUseCase.execute(principal, r1.id, {
        status: 'APPROVED',
        version: 1,
      });
      assert.strictEqual(updated.status, 'APPROVED');
      assert.strictEqual(updated.version, 2);
    });
  });
});
