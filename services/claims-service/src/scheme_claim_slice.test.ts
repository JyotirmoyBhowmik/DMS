import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { SchemeClaim, DomainError, InvalidStateTransitionError } from './domain/entities/scheme_claim.js';
import { SchemeClaimPgRepository } from './infrastructure/database/repositories/scheme_claim.pg-repository.js';
import { CreateSchemeClaimUseCase } from './application/usecases/create-scheme-claim.usecase.js';
import { GetSchemeClaimUseCase } from './application/usecases/get-scheme-claim.usecase.js';
import { UpdateSchemeClaimUseCase } from './application/usecases/update-scheme-claim.usecase.js';
import { ListSchemeClaimsUseCase } from './application/usecases/list-scheme-claims.usecase.js';
import { randomUUID } from 'node:crypto';

describe('SchemeClaim Full Vertical Slice Unit & Repo Tests', () => {
  let repository: SchemeClaimPgRepository;
  let createUseCase: CreateSchemeClaimUseCase;
  let getUseCase: GetSchemeClaimUseCase;
  let updateUseCase: UpdateSchemeClaimUseCase;
  let listUseCase: ListSchemeClaimsUseCase;

  const tenantId = randomUUID();
  const schemeId = randomUUID();
  const distributorId = randomUUID();

  const adminPrincipal: any = {
    userId: 'user-admin-1',
    tenantId,
    roles: ['admin'],
    permissions: ['scheme_claim:create', 'scheme_claim:read', 'scheme_claim:update', 'scheme_claim:delete', 'scheme_claim:approve'],
  };

  beforeEach(() => {
    SchemeClaimPgRepository.clearStore();
    repository = new SchemeClaimPgRepository();
    createUseCase = new CreateSchemeClaimUseCase(repository);
    getUseCase = new GetSchemeClaimUseCase(repository);
    updateUseCase = new UpdateSchemeClaimUseCase(repository);
    listUseCase = new ListSchemeClaimsUseCase(repository);
  });

  describe('SchemeClaim Domain Aggregate Invariants', () => {
    it('validates claimAmountCents range and state machine transitions', () => {
      assert.throws(() => {
        new SchemeClaim({
          tenantId,
          claimCode: 'SCH-CLM-001',
          schemeId,
          distributorId,
          claimAmountCents: -50,
        });
      }, DomainError);

      const claim = new SchemeClaim({
        tenantId,
        claimCode: 'SCH-CLM-001',
        schemeId,
        distributorId,
        claimAmountCents: 50000,
      });

      assert.strictEqual(claim.status, 'SUBMITTED');
      claim.updateStatus('UNDER_REVIEW');
      assert.strictEqual(claim.status, 'UNDER_REVIEW');

      claim.updateStatus('APPROVED', 45000);
      assert.strictEqual(claim.status, 'APPROVED');
      assert.strictEqual(claim.approvedAmountCents, 45000);

      assert.throws(() => {
        claim.updateStatus('SUBMITTED');
      }, InvalidStateTransitionError);
    });
  });

  describe('SchemeClaim Use Cases & Repository', () => {
    it('executes Create, Get, Update, and List with idempotency key', async () => {
      const created = await createUseCase.execute(
        adminPrincipal,
        {
          claimCode: 'SCH-CLM-100',
          schemeId,
          distributorId,
          claimAmountCents: 100000,
        } as any,

        'idempotency-key-scheme-claim-1'
      );

      assert.strictEqual(created.claimCode, 'SCH-CLM-100');
      assert.strictEqual(created.claimAmountCents, 100000);

      const fetched = await getUseCase.execute(adminPrincipal, created.id);
      assert.strictEqual(fetched.id, created.id);

      const updated = await updateUseCase.execute(adminPrincipal, created.id, {
        status: 'UNDER_REVIEW',
        version: 1,
      });
      assert.strictEqual(updated.status, 'UNDER_REVIEW');

      const listRes = await listUseCase.execute(adminPrincipal, { page: 1, limit: 10 });
      assert.strictEqual(listRes.total, 1);
      assert.strictEqual(listRes.data[0].id, created.id);
    });
  });
});
