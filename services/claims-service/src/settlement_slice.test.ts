import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Settlement, DomainError, InvalidStateTransitionError } from './domain/entities/settlement.js';
import { SettlementPgRepository } from './infrastructure/database/repositories/settlement.pg-repository.js';
import { CreateSettlementUseCase } from './application/usecases/create-settlement.usecase.js';
import { GetSettlementUseCase } from './application/usecases/get-settlement.usecase.js';
import { UpdateSettlementUseCase } from './application/usecases/update-settlement.usecase.js';
import { ListSettlementsUseCase } from './application/usecases/list-settlements.usecase.js';
import { randomUUID } from 'node:crypto';

describe('Settlement Full Vertical Slice Unit & Repo Tests', () => {
  let repository: SettlementPgRepository;
  let createUseCase: CreateSettlementUseCase;
  let getUseCase: GetSettlementUseCase;
  let updateUseCase: UpdateSettlementUseCase;
  let listUseCase: ListSettlementsUseCase;

  const tenantId = randomUUID();
  const claimId = randomUUID();
  const distributorId = randomUUID();

  const adminPrincipal: any = {
    userId: 'user-admin-1',
    tenantId,
    roles: ['admin'],
    permissions: ['settlement:create', 'settlement:read', 'settlement:update', 'settlement:delete', 'settlement:approve'],
  };

  beforeEach(() => {
    SettlementPgRepository.clearStore();
    repository = new SettlementPgRepository();
    createUseCase = new CreateSettlementUseCase(repository);
    getUseCase = new GetSettlementUseCase(repository);
    updateUseCase = new UpdateSettlementUseCase(repository);
    listUseCase = new ListSettlementsUseCase(repository);
  });

  describe('Settlement Domain Aggregate Invariants', () => {
    it('validates amountCents range and state machine transitions', () => {
      assert.throws(() => {
        new Settlement({
          tenantId,
          settlementCode: 'SET-001',
          claimId,
          distributorId,
          amountCents: -100,
        });
      }, DomainError);

      const st = new Settlement({
        tenantId,
        settlementCode: 'SET-001',
        claimId,
        distributorId,
        amountCents: 150000,
      });

      assert.strictEqual(st.status, 'INITIATED');

      st.updateStatus('PROCESSING');
      assert.strictEqual(st.status, 'PROCESSING');

      st.updateStatus('SETTLED', 'PAY-REF-999');
      assert.strictEqual(st.status, 'SETTLED');
      assert.strictEqual(st.paymentReference, 'PAY-REF-999');

      assert.throws(() => {
        st.updateStatus('INITIATED');
      }, InvalidStateTransitionError);
    });
  });

  describe('Settlement Use Cases & Repository', () => {
    it('executes Create, Get, Update, and List with idempotency key', async () => {
      const created = await createUseCase.execute(
        adminPrincipal,
        {
          settlementCode: 'SET-100',
          claimId,
          distributorId,
          amountCents: 250000,
        } as any,
        'idempotency-key-set-1'
      );

      assert.strictEqual(created.settlementCode, 'SET-100');
      assert.strictEqual(created.amountCents, 250000);

      const fetched = await getUseCase.execute(adminPrincipal, created.id);
      assert.strictEqual(fetched.id, created.id);

      const updated = await updateUseCase.execute(adminPrincipal, created.id, {
        status: 'PROCESSING',
        version: 1,
      });
      assert.strictEqual(updated.status, 'PROCESSING');

      const listRes = await listUseCase.execute(adminPrincipal, { page: 1, limit: 10 });
      assert.strictEqual(listRes.total, 1);
      assert.strictEqual(listRes.data[0].id, created.id);
    });
  });
});
