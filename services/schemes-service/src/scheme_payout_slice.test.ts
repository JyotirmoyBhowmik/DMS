import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { SchemePayout } from './domain/entities/scheme_payout.js';
import { SchemePayoutPgRepository } from './infrastructure/database/repositories/scheme_payout.pg-repository.js';
import { CreateSchemePayoutUseCase } from './application/usecases/create-scheme-payout.usecase.js';
import { GetSchemePayoutUseCase } from './application/usecases/get-scheme-payout.usecase.js';
import { UpdateSchemePayoutUseCase } from './application/usecases/update-scheme-payout.usecase.js';
import { ListSchemePayoutsUseCase } from './application/usecases/list-scheme-payouts.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('SchemePayout Full Vertical Slice Unit & Repo Tests', () => {
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
    SchemePayoutPgRepository.clearStore();
  });

  describe('SchemePayout Domain Aggregate Invariants', () => {
    test('validates amountCents range and state machine transitions', () => {
      // Invalid amountCents guard clause
      assert.throws(
        () => new SchemePayout({
          id: randomUUID(),
          tenantId,
          schemeId: randomUUID(),
          distributorId: randomUUID(),
          name: 'Invalid Payout',
          payoutCode: 'PAYOUT-INVALID',
          amountCents: -500,
        }),
        /amountCents must be non-negative/
      );

      const payout = SchemePayout.create({
        id: randomUUID(),
        tenantId,
        schemeId: randomUUID(),
        distributorId: randomUUID(),
        name: 'Distributor Q1 Rebate',
        payoutCode: 'PAYOUT-Q1-DIST-1',
        amountCents: 2500000,
        payoutType: 'CREDIT_NOTE',
      });

      assert.strictEqual(payout.status, 'PENDING');

      // State transition: PENDING -> APPROVED -> DISBURSED
      payout.updateStatus('APPROVED');
      assert.strictEqual(payout.status, 'APPROVED');

      payout.updateStatus('DISBURSED');
      assert.strictEqual(payout.status, 'DISBURSED');

      // Illegal transition after DISBURSED
      assert.throws(
        () => payout.updateStatus('PENDING'),
        /Cannot transition from final status/
      );
    });
  });

  describe('SchemePayout Use Cases & Repository', () => {
    test('executes Create with idempotency key and enforces unique payout code per scheme', async () => {
      const repo = new SchemePayoutPgRepository(mockDb);
      const createUseCase = new CreateSchemePayoutUseCase(repo);
      const getUseCase = new GetSchemePayoutUseCase(repo);
      const updateUseCase = new UpdateSchemePayoutUseCase(repo);
      const listUseCase = new ListSchemePayoutsUseCase(repo);

      const schemeId = randomUUID();
      const distributorId = randomUUID();
      const dto = {
        name: 'Diwali Scheme Disbursal',
        payoutCode: 'PAYOUT-DIWALI-001',
        schemeId,
        distributorId,
        amountCents: 1500000,
        payoutType: 'BANK_TRANSFER' as const,
      };

      // Create initial
      const p1 = await createUseCase.execute(principal, dto, 'key-payout-101');
      assert.strictEqual(p1.payoutCode, 'PAYOUT-DIWALI-001');

      // Idempotent retry
      const p2 = await createUseCase.execute(principal, dto, 'key-payout-101');
      assert.strictEqual(p2.id, p1.id);

      // Duplicate record error
      await assert.rejects(
        () => createUseCase.execute(principal, dto),
        /SchemePayout with code PAYOUT-DIWALI-001 already exists for this scheme/
      );

      // Get
      const fetched = await getUseCase.execute(principal, p1.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.name, 'Diwali Scheme Disbursal');

      // List
      const list = await listUseCase.execute(principal, { payoutCode: 'PAYOUT-DIWALI-001' });
      assert.strictEqual(list.total, 1);

      // Update status
      const updated = await updateUseCase.execute(principal, p1.id, {
        status: 'APPROVED',
        version: 1,
      });
      assert.strictEqual(updated.status, 'APPROVED');
      assert.strictEqual(updated.version, 2);
    });
  });
});
