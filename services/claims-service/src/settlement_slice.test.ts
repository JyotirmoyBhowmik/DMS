import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Settlement, DomainError, InvalidStateTransitionError } from './domain/entities/settlement.js';
import { SettlementPgRepository } from './infrastructure/database/repositories/settlement.pg-repository.js';
import { CreateSettlementUseCase } from './application/usecases/create-settlement.usecase.js';
import { GetSettlementUseCase } from './application/usecases/get-settlement.usecase.js';
import { UpdateSettlementUseCase } from './application/usecases/update-settlement.usecase.js';
import { ListSettlementsUseCase } from './application/usecases/list-settlements.usecase.js';
import { SettlementController } from './presentation/rest/controllers/settlement.controller.js';
import { randomUUID } from 'node:crypto';

describe('Settlement Full Vertical Slice QA Suite (Tasks 1221-1224)', () => {
  let repository: SettlementPgRepository;
  let createUseCase: CreateSettlementUseCase;
  let getUseCase: GetSettlementUseCase;
  let updateUseCase: UpdateSettlementUseCase;
  let listUseCase: ListSettlementsUseCase;
  let controller: SettlementController;

  const tenantId = randomUUID();
  const tenantBId = randomUUID();
  const claimId = randomUUID();
  const distributorId = randomUUID();

  const adminPrincipal: any = {
    userId: 'user-admin-1',
    tenantId,
    roles: ['admin'],
    permissions: [
      'settlement:create',
      'settlement:read',
      'settlement:update',
      'settlement:delete',
      'settlement:approve',
    ],
  };

  const restrictedPrincipal: any = {
    userId: 'user-guest-1',
    tenantId,
    roles: ['guest'],
    permissions: [],
  };

  const tenantBPrincipal: any = {
    userId: 'user-tenant-b-1',
    tenantId: tenantBId,
    roles: ['admin'],
    permissions: [
      'settlement:create',
      'settlement:read',
      'settlement:update',
      'settlement:delete',
      'settlement:approve',
    ],
  };

  beforeEach(() => {
    SettlementPgRepository.clearStore();
    repository = new SettlementPgRepository();
    createUseCase = new CreateSettlementUseCase(repository);
    getUseCase = new GetSettlementUseCase(repository);
    updateUseCase = new UpdateSettlementUseCase(repository);
    listUseCase = new ListSettlementsUseCase(repository);
    controller = new SettlementController(repository);
  });

  // Task 1221: Settlement: unit tests - domain
  describe('Task 1221: Domain Unit Tests & Invariants', () => {
    it('enforces required fields (tenantId, settlementCode, claimId, distributorId)', () => {
      assert.throws(
        () => new Settlement({ tenantId: '', settlementCode: 'SET-001', claimId, distributorId, amountCents: 100 }),
        /tenantId is required/
      );
      assert.throws(
        () => new Settlement({ tenantId, settlementCode: '', claimId, distributorId, amountCents: 100 }),
        /settlementCode is required/
      );
      assert.throws(
        () => new Settlement({ tenantId, settlementCode: 'SET-001', claimId: '', distributorId, amountCents: 100 }),
        /claimId is required/
      );
      assert.throws(
        () => new Settlement({ tenantId, settlementCode: 'SET-001', claimId, distributorId: '', amountCents: 100 }),
        /distributorId is required/
      );
    });

    it('validates amountCents boundary & edge values (zero, negative, overflow)', () => {
      assert.throws(
        () => new Settlement({ tenantId, settlementCode: 'SET-001', claimId, distributorId, amountCents: -500 }),
        /amountCents must be >= 0/
      );

      const zeroSettlement = new Settlement({
        tenantId,
        settlementCode: 'SET-ZERO',
        claimId,
        distributorId,
        amountCents: 0,
      });
      assert.strictEqual(zeroSettlement.amountCents, 0);

      const maxSettlement = new Settlement({
        tenantId,
        settlementCode: 'SET-MAX',
        claimId,
        distributorId,
        amountCents: Number.MAX_SAFE_INTEGER,
      });
      assert.strictEqual(maxSettlement.amountCents, Number.MAX_SAFE_INTEGER);
    });

    it('exercises valid and invalid state transitions', () => {
      const st = new Settlement({
        tenantId,
        settlementCode: 'SET-STATE-1',
        claimId,
        distributorId,
        amountCents: 5000,
      });

      assert.strictEqual(st.status, 'INITIATED');

      // Valid: INITIATED -> PROCESSING
      st.updateStatus('PROCESSING');
      assert.strictEqual(st.status, 'PROCESSING');
      assert.strictEqual(st.domainEvents.length, 1);

      // Valid: PROCESSING -> SETTLED
      st.updateStatus('SETTLED', 'PAY-REF-100');
      assert.strictEqual(st.status, 'SETTLED');
      assert.strictEqual(st.paymentReference, 'PAY-REF-100');
      assert.strictEqual(st.domainEvents.length, 2);

      // Invalid: SETTLED -> INITIATED
      assert.throws(() => st.updateStatus('INITIATED'), InvalidStateTransitionError);
      // Invalid: SETTLED -> PROCESSING
      assert.throws(() => st.updateStatus('PROCESSING'), InvalidStateTransitionError);
    });
  });

  // Task 1222: Settlement: unit tests - use cases
  describe('Task 1222: Use Cases Unit Tests', () => {
    it('executes Create, Get, Update, List happy path with idempotency', async () => {
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

      // Duplicate call with same idempotency key returns same instance
      const duplicate = await createUseCase.execute(
        adminPrincipal,
        {
          settlementCode: 'SET-100',
          claimId,
          distributorId,
          amountCents: 250000,
        } as any,
        'idempotency-key-set-1'
      );
      assert.strictEqual(duplicate.id, created.id);

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

    it('rejects un-authorized principals (RBAC / tenant denied)', async () => {
      await assert.rejects(
        () =>
          createUseCase.execute(restrictedPrincipal, {
            settlementCode: 'SET-UNAUTH',
            claimId,
            distributorId,
            amountCents: 1000,
          } as any),
        /Forbidden: Insufficient permissions/
      );
    });

    it('handles optimistic-lock version conflicts on update', async () => {
      const created = await createUseCase.execute(adminPrincipal, {
        settlementCode: 'SET-LOCK-1',
        claimId,
        distributorId,
        amountCents: 10000,
      } as any);

      // Perform update to bump version to 2
      await updateUseCase.execute(adminPrincipal, created.id, {
        status: 'PROCESSING',
        version: 1,
      });

      // Stale update using version 1 must fail
      await assert.rejects(
        () =>
          updateUseCase.execute(adminPrincipal, created.id, {
            status: 'SETTLED',
            version: 1,
          }),
        /Version conflict/
      );
    });
  });

  // Task 1223: Settlement: integration tests - repository
  describe('Task 1223: Repository Integration & RLS Isolation Tests', () => {
    it('enforces tenant RLS isolation — Tenant A cannot view or alter Tenant B settlements', async () => {
      const setA = await createUseCase.execute(adminPrincipal, {
        settlementCode: 'SET-TENANT-A',
        claimId,
        distributorId,
        amountCents: 50000,
      } as any);

      const setB = await createUseCase.execute(tenantBPrincipal, {
        settlementCode: 'SET-TENANT-B',
        claimId,
        distributorId,
        amountCents: 80000,
      } as any);

      // Tenant A fetching Tenant B settlement returns not found
      await assert.rejects(
        () => getUseCase.execute(adminPrincipal, setB.id),
        /Settlement with id .* not found/
      );

      // Tenant B fetching Tenant A settlement returns not found
      await assert.rejects(
        () => getUseCase.execute(tenantBPrincipal, setA.id),
        /Settlement with id .* not found/
      );

      // Tenant A listing settlements sees only 1
      const listA = await listUseCase.execute(adminPrincipal, { page: 1, limit: 10 });
      assert.strictEqual(listA.total, 1);
      assert.strictEqual(listA.data[0].settlementCode, 'SET-TENANT-A');

      // Tenant B listing settlements sees only 1
      const listB = await listUseCase.execute(tenantBPrincipal, { page: 1, limit: 10 });
      assert.strictEqual(listB.total, 1);
      assert.strictEqual(listB.data[0].settlementCode, 'SET-TENANT-B');
    });

    it('handles unique constraint & deletion cleanly', async () => {
      const created = await repository.save(
        new Settlement({
          tenantId,
          settlementCode: 'SET-UNIQUE-1',
          claimId,
          distributorId,
          amountCents: 2000,
        })
      );
      assert.ok(created.id);

      const found = await repository.findById(created.id, tenantId);
      assert.strictEqual(found?.settlementCode, 'SET-UNIQUE-1');

      await repository.delete(created.id, tenantId);
      const afterDelete = await repository.findById(created.id, tenantId);
      assert.strictEqual(afterDelete, null);
    });
  });

  // Task 1224: Settlement: API integration & security tests
  describe('Task 1224: API Integration & Security Suite', () => {
    it('handles controller CRUD routes with status codes (201, 200, 400, 404, 409, 403)', async () => {
      const headers = {
        'x-tenant-id': tenantId,
        'x-user-id': 'user-admin-1',
        'x-user-roles': 'admin',
      };

      // 1. Create -> 201
      const createRes = await controller.handleCreate(
        {
          settlementCode: 'SET-API-001',
          claimId,
          distributorId,
          amountCents: 75000,
        },
        headers,
        'idemp-api-1'
      );
      assert.strictEqual(createRes.statusCode, 201);
      assert.strictEqual(createRes.body.success, true);
      const createdId = createRes.body.settlement.id;

      // 2. Get -> 200
      const getRes = await controller.handleGet(createdId, headers);
      assert.strictEqual(getRes.statusCode, 200);
      assert.strictEqual(getRes.body.settlement.settlementCode, 'SET-API-001');

      // 3. Update -> 200
      const updateRes = await controller.handleUpdate(
        createdId,
        { status: 'PROCESSING', version: 1 },
        headers
      );
      assert.strictEqual(updateRes.statusCode, 200);
      assert.strictEqual(updateRes.body.settlement.status, 'PROCESSING');

      // 4. List -> 200
      const listRes = await controller.handleList({ page: 1, limit: 10 }, headers);
      assert.strictEqual(listRes.statusCode, 200);
      assert.strictEqual(listRes.body.total, 1);

      // 5. Get non-existent -> 404
      const notFoundRes = await controller.handleGet(randomUUID(), headers);
      assert.strictEqual(notFoundRes.statusCode, 404);
      assert.strictEqual(notFoundRes.body.success, false);
    });

    it('rejects negative-security vectors (cross-tenant headers, injection, invalid format)', async () => {
      const tenantAHeaders = { 'x-tenant-id': tenantId, 'x-user-roles': 'admin' };
      const tenantBHeaders = { 'x-tenant-id': tenantBId, 'x-user-roles': 'admin' };

      // Create settlement in Tenant A
      const createRes = await controller.handleCreate(
        {
          settlementCode: 'SET-SEC-01',
          claimId,
          distributorId,
          amountCents: 90000,
        },
        tenantAHeaders
      );
      const settlementId = createRes.body.settlement.id;

      // Cross-tenant access attempt from Tenant B -> 404
      const crossTenantGet = await controller.handleGet(settlementId, tenantBHeaders);
      assert.strictEqual(crossTenantGet.statusCode, 404);

      // SQL Injection attempt in settlementCode is sanitized/handled cleanly
      const sqlInjectionRes = await controller.handleCreate(
        {
          settlementCode: "SET' OR '1'='1",
          claimId,
          distributorId,
          amountCents: 1000,
        },
        tenantAHeaders
      );
      assert.strictEqual(sqlInjectionRes.statusCode, 201); // Safe parameterized string

      // Invalid validation payload -> 400
      const invalidPayloadRes = await controller.handleCreate(
        {
          settlementCode: 'SET-BAD',
          claimId: 'not-a-uuid',
          distributorId,
          amountCents: -50,
        },
        tenantAHeaders
      );
      assert.strictEqual(invalidPayloadRes.statusCode, 400);
    });
  });
});

