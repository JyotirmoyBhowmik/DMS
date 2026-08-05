import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ReturnEntity } from './domain/entities/return.js';
import { ReturnPgRepository } from './infrastructure/database/repositories/return.pg-repository.js';
import { CreateReturnUseCase } from './application/usecases/return/create-return.usecase.js';
import { GetReturnUseCase } from './application/usecases/return/get-return.usecase.js';
import { UpdateReturnUseCase } from './application/usecases/return/update-return.usecase.js';
import { ListReturnsUseCase } from './application/usecases/return/list-returns.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('Return Full Vertical Slice Unit & Repo Tests', () => {
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
    ReturnPgRepository.clearStore();
  });

  describe('Return Domain Aggregate Invariants', () => {
    test('validates quantity guard clause and state machine transitions', () => {
      // Non-positive quantity guard clause
      assert.throws(
        () => new ReturnEntity({
          id: randomUUID(),
          tenantId,
          returnNumber: 'RET-001',
          outletId: 'outlet-01',
          warehouseId: 'wh-01',
          skuId: 'sku-01',
          quantity: 0,
          reason: 'DAMAGED',
          totalAmountCents: 1000,
        }),
        /quantity must be positive/
      );

      const ret = ReturnEntity.create({
        id: randomUUID(),
        tenantId,
        returnNumber: 'RET-002',
        outletId: 'outlet-02',
        warehouseId: 'wh-main',
        skuId: 'sku-02',
        quantity: 10,
        reason: 'EXPIRED',
        totalAmountCents: 2500,
      });

      assert.strictEqual(ret.status, 'REQUESTED');

      // Valid state transition: REQUESTED -> APPROVED -> INSPECTED -> REFUNDED
      ret.updateStatus('APPROVED');
      assert.strictEqual(ret.status, 'APPROVED');

      ret.updateStatus('INSPECTED');
      assert.strictEqual(ret.status, 'INSPECTED');

      ret.updateStatus('REFUNDED');
      assert.strictEqual(ret.status, 'REFUNDED');

      // Illegal transition after REFUNDED
      assert.throws(
        () => ret.updateStatus('REJECTED'),
        /Cannot transition from final status/
      );
    });
  });

  describe('Return Use Cases & Repository', () => {
    test('executes Create with idempotency key and enforces unique returnNumber per tenant', async () => {
      const repo = new ReturnPgRepository(mockDb);
      const createUseCase = new CreateReturnUseCase(repo);
      const getUseCase = new GetReturnUseCase(repo);
      const updateUseCase = new UpdateReturnUseCase(repo);
      const listUseCase = new ListReturnsUseCase(repo);

      const dto = {
        returnNumber: 'RET-2026-X',
        outletId: 'outlet-101',
        warehouseId: 'wh-main',
        skuId: 'sku-item-1',
        quantity: 20,
        reason: 'EXPIRED',
        totalAmountCents: 5000,
      };

      // Create initial
      const r1 = await createUseCase.execute(principal, dto, 'key-ret-101');
      assert.strictEqual(r1.returnNumber, 'RET-2026-X');

      // Idempotent retry
      const r2 = await createUseCase.execute(principal, dto, 'key-ret-101');
      assert.strictEqual(r2.id, r1.id);

      // Duplicate record error
      await assert.rejects(
        () => createUseCase.execute(principal, dto),
        /Return request with number RET-2026-X already exists/
      );

      // Get
      const fetched = await getUseCase.execute(principal, r1.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.outletId, 'outlet-101');

      // List
      const list = await listUseCase.execute(principal, { outletId: 'outlet-101' });
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
