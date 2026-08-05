import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ClaimReconciliation, DomainError, InvalidStateTransitionError } from './domain/entities/claim_reconciliation.js';
import { ClaimReconciliationPgRepository } from './infrastructure/database/repositories/claim_reconciliation.pg-repository.js';
import { CreateClaimReconciliationUseCase } from './application/usecases/create-claim-reconciliation.usecase.js';
import { GetClaimReconciliationUseCase } from './application/usecases/get-claim-reconciliation.usecase.js';
import { UpdateClaimReconciliationUseCase } from './application/usecases/update-claim-reconciliation.usecase.js';
import { ListClaimReconciliationsUseCase } from './application/usecases/list-claim-reconciliations.usecase.js';
import { randomUUID } from 'node:crypto';

describe('ClaimReconciliation Full Vertical Slice Unit & Repo Tests', () => {
  let repository: ClaimReconciliationPgRepository;
  let createUseCase: CreateClaimReconciliationUseCase;
  let getUseCase: GetClaimReconciliationUseCase;
  let updateUseCase: UpdateClaimReconciliationUseCase;
  let listUseCase: ListClaimReconciliationsUseCase;

  const tenantId = randomUUID();
  const distributorId = randomUUID();

  const adminPrincipal: any = {
    userId: 'user-admin-1',
    tenantId,
    roles: ['admin'],
    permissions: ['claim_reconciliation:create', 'claim_reconciliation:read', 'claim_reconciliation:update', 'claim_reconciliation:delete', 'claim_reconciliation:approve'],
  };

  beforeEach(() => {
    ClaimReconciliationPgRepository.clearStore();
    repository = new ClaimReconciliationPgRepository();
    createUseCase = new CreateClaimReconciliationUseCase(repository);
    getUseCase = new GetClaimReconciliationUseCase(repository);
    updateUseCase = new UpdateClaimReconciliationUseCase(repository);
    listUseCase = new ListClaimReconciliationsUseCase(repository);
  });

  describe('ClaimReconciliation Domain Aggregate Invariants', () => {
    it('validates totalClaimedCents range and state machine transitions', () => {
      assert.throws(() => {
        new ClaimReconciliation({
          tenantId,
          reconciliationCode: 'REC-CLM-001',
          distributorId,
          totalClaimedCents: -500,
        });
      }, DomainError);

      const rec = new ClaimReconciliation({
        tenantId,
        reconciliationCode: 'REC-CLM-001',
        distributorId,
        totalClaimedCents: 500000,
      });

      assert.strictEqual(rec.status, 'DRAFT');
      assert.strictEqual(rec.discrepancyCents, 500000);

      rec.updateStatus('IN_PROGRESS');
      assert.strictEqual(rec.status, 'IN_PROGRESS');

      rec.updateStatus('RECONCILED', 500000);
      assert.strictEqual(rec.status, 'RECONCILED');
      assert.strictEqual(rec.discrepancyCents, 0);

      assert.throws(() => {
        rec.updateStatus('DRAFT');
      }, InvalidStateTransitionError);
    });
  });

  describe('ClaimReconciliation Use Cases & Repository', () => {
    it('executes Create, Get, Update, and List with idempotency key', async () => {
      const created = await createUseCase.execute(
        adminPrincipal,
        {
          reconciliationCode: 'REC-CLM-100',
          distributorId,
          totalClaimedCents: 200000,
        } as any,
        'idempotency-key-rec-1'
      );

      assert.strictEqual(created.reconciliationCode, 'REC-CLM-100');
      assert.strictEqual(created.totalClaimedCents, 200000);

      const fetched = await getUseCase.execute(adminPrincipal, created.id);
      assert.strictEqual(fetched.id, created.id);

      const updated = await updateUseCase.execute(adminPrincipal, created.id, {
        status: 'IN_PROGRESS',
        version: 1,
      });
      assert.strictEqual(updated.status, 'IN_PROGRESS');

      const listRes = await listUseCase.execute(adminPrincipal, { page: 1, limit: 10 });
      assert.strictEqual(listRes.total, 1);
      assert.strictEqual(listRes.data[0].id, created.id);
    });
  });
});
