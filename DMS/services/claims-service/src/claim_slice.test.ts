import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Claim } from './domain/entities/claim.js';
import { ClaimPgRepository } from './infrastructure/database/repositories/claim.pg-repository.js';
import { CreateClaimUseCase } from './application/usecases/create-claim.usecase.js';
import { GetClaimUseCase } from './application/usecases/get-claim.usecase.js';
import { UpdateClaimUseCase } from './application/usecases/update-claim.usecase.js';
import { ListClaimsUseCase } from './application/usecases/list-claims.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('Claim Full Vertical Slice Unit & Repo Tests', () => {
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
    ClaimPgRepository.clearStore();
  });

  describe('Claim Domain Aggregate Invariants', () => {
    test('validates claimAmountCents range and state machine transitions', () => {
      // Invalid claimAmountCents guard clause
      assert.throws(
        () => new Claim({
          id: randomUUID(),
          tenantId,
          distributorId: randomUUID(),
          schemeId: randomUUID(),
          name: 'Invalid Claim',
          claimCode: 'CLAIM-INVALID',
          claimAmountCents: -100,
        }),
        /claimAmountCents must be non-negative/
      );

      const claim = Claim.create({
        id: randomUUID(),
        tenantId,
        distributorId: randomUUID(),
        schemeId: randomUUID(),
        name: 'Q1 Promotional Rebate Claim',
        claimCode: 'CLAIM-Q1-001',
        claimAmountCents: 500000,
      });

      assert.strictEqual(claim.status, 'SUBMITTED');

      // State transition: SUBMITTED -> UNDER_REVIEW -> APPROVED -> SETTLED
      claim.updateStatus('UNDER_REVIEW');
      assert.strictEqual(claim.status, 'UNDER_REVIEW');

      claim.updateStatus('APPROVED', 450000);
      assert.strictEqual(claim.status, 'APPROVED');
      assert.strictEqual(claim.approvedAmountCents, 450000);

      claim.updateStatus('SETTLED');
      assert.strictEqual(claim.status, 'SETTLED');

      // Illegal transition after SETTLED
      assert.throws(
        () => claim.updateStatus('SUBMITTED'),
        /Cannot transition from final status/
      );
    });
  });

  describe('Claim Use Cases & Repository', () => {
    test('executes Create with idempotency key and enforces unique claim code per tenant', async () => {
      const repo = new ClaimPgRepository(mockDb);
      const createUseCase = new CreateClaimUseCase(repo);
      const getUseCase = new GetClaimUseCase(repo);
      const updateUseCase = new UpdateClaimUseCase(repo);
      const listUseCase = new ListClaimsUseCase(repo);

      const distributorId = randomUUID();
      const schemeId = randomUUID();
      const dto = {
        name: 'Festive Season Free Product Claim',
        claimCode: 'CLAIM-FESTIVE-999',
        distributorId,
        schemeId,
        claimAmountCents: 1200000,
      };

      // Create initial
      const c1 = await createUseCase.execute(principal, dto, 'key-claim-101');
      assert.strictEqual(c1.claimCode, 'CLAIM-FESTIVE-999');

      // Idempotent retry
      const c2 = await createUseCase.execute(principal, dto, 'key-claim-101');
      assert.strictEqual(c2.id, c1.id);

      // Duplicate record error
      await assert.rejects(
        () => createUseCase.execute(principal, dto),
        /Claim with code CLAIM-FESTIVE-999 already exists/
      );

      // Get
      const fetched = await getUseCase.execute(principal, c1.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.name, 'Festive Season Free Product Claim');

      // List
      const list = await listUseCase.execute(principal, { claimCode: 'CLAIM-FESTIVE-999' });
      assert.strictEqual(list.total, 1);

      // Update status
      const updated = await updateUseCase.execute(principal, c1.id, {
        status: 'APPROVED',
        approvedAmountCents: 1200000,
        version: 1,
      });
      assert.strictEqual(updated.status, 'APPROVED');
      assert.strictEqual(updated.version, 2);
    });
  });
});
