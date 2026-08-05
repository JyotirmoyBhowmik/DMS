import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Scheme } from './domain/entities/scheme.js';
import { SchemePgRepository } from './infrastructure/database/repositories/scheme.pg-repository.js';
import { CreateSchemeUseCase } from './application/usecases/create-scheme.usecase.js';
import { GetSchemeUseCase } from './application/usecases/get-scheme.usecase.js';
import { UpdateSchemeUseCase } from './application/usecases/update-scheme.usecase.js';
import { ListSchemesUseCase } from './application/usecases/list-schemes.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('Scheme Full Vertical Slice Unit & Repo Tests', () => {
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
    SchemePgRepository.clearStore();
  });

  describe('Scheme Domain Aggregate Invariants', () => {
    test('validates required fields and state machine transitions', () => {
      // Missing required field guard clause
      assert.throws(
        () => new Scheme({
          id: randomUUID(),
          tenantId,
          name: '',
          code: 'SCH-INVALID',
        }),
        /Scheme must have id, tenantId, name, and code/
      );

      const scheme = Scheme.create({
        id: randomUUID(),
        tenantId,
        name: 'Festive Buy 1 Get 1',
        code: 'SCH-BOGO-2026',
        schemeType: 'BUY_X_GET_Y',
        description: 'Buy 1 case get 1 box free',
      });

      assert.strictEqual(scheme.status, 'DRAFT');

      // Valid state transitions: DRAFT -> ACTIVE -> EXPIRED -> ARCHIVED
      scheme.updateStatus('ACTIVE');
      assert.strictEqual(scheme.status, 'ACTIVE');

      scheme.updateStatus('EXPIRED');
      assert.strictEqual(scheme.status, 'EXPIRED');

      scheme.updateStatus('ARCHIVED');
      assert.strictEqual(scheme.status, 'ARCHIVED');

      // Illegal transition after ARCHIVED
      assert.throws(
        () => scheme.updateStatus('ACTIVE'),
        /Cannot transition from final status/
      );
    });
  });

  describe('Scheme Use Cases & Repository', () => {
    test('executes Create with idempotency key and enforces unique code per tenant', async () => {
      const repo = new SchemePgRepository(mockDb);
      const createUseCase = new CreateSchemeUseCase(repo);
      const getUseCase = new GetSchemeUseCase(repo);
      const updateUseCase = new UpdateSchemeUseCase(repo);
      const listUseCase = new ListSchemesUseCase(repo);

      const dto = {
        name: 'Monsoon Volume Discount',
        code: 'SCH-VOL-MONSOON',
        schemeType: 'QUANTITY_DISCOUNT' as const,
        description: '10% off for 100+ cases',
      };

      // Create initial
      const s1 = await createUseCase.execute(principal, dto, 'key-scheme-101');
      assert.strictEqual(s1.code, 'SCH-VOL-MONSOON');

      // Idempotent retry
      const s2 = await createUseCase.execute(principal, dto, 'key-scheme-101');
      assert.strictEqual(s2.id, s1.id);

      // Duplicate record error
      await assert.rejects(
        () => createUseCase.execute(principal, dto),
        /Scheme with code SCH-VOL-MONSOON already exists/
      );

      // Get
      const fetched = await getUseCase.execute(principal, s1.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.name, 'Monsoon Volume Discount');

      // List
      const list = await listUseCase.execute(principal, { code: 'SCH-VOL-MONSOON' });
      assert.strictEqual(list.total, 1);

      // Update status
      const updated = await updateUseCase.execute(principal, s1.id, {
        status: 'ACTIVE',
        version: 1,
      });
      assert.strictEqual(updated.status, 'ACTIVE');
      assert.strictEqual(updated.version, 2);
    });
  });
});
