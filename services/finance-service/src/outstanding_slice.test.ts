import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Outstanding, OutstandingDomainError, InvalidOutstandingStateTransitionError } from './domain/entities/outstanding.entity.js';
import { validateCreateOutstandingInput, validateUpdateOutstandingInput } from './domain/validation/outstanding.validation.js';
import { OutstandingPgRepository } from './infrastructure/database/repositories/outstanding.pg-repository.js';
import { CreateOutstandingUseCase } from './application/usecases/create-outstanding.usecase.js';
import { GetOutstandingUseCase } from './application/usecases/get-outstanding.usecase.js';
import { UpdateOutstandingUseCase } from './application/usecases/update-outstanding.usecase.js';
import { ListOutstandingsUseCase } from './application/usecases/list-outstandings.usecase.js';
import { OutstandingController } from './presentation/rest/controllers/outstanding.controller.js';
import { OutstandingAuditService } from './infrastructure/audit/outstanding.audit.js';
import { randomUUID } from 'node:crypto';

describe('Outstanding Full Vertical Slice QA & Security Suite (Tasks 1335-1340)', () => {
  let repository: OutstandingPgRepository;
  let createUseCase: CreateOutstandingUseCase;
  let getUseCase: GetOutstandingUseCase;
  let updateUseCase: UpdateOutstandingUseCase;
  let listUseCase: ListOutstandingsUseCase;
  let controller: OutstandingController;

  const tenantId = randomUUID();
  const tenantBId = randomUUID();
  const distributorId = randomUUID();

  const adminPrincipal: any = {
    userId: 'user-admin-out-1',
    tenantId,
    roles: ['admin'],
    permissions: [
      'finance:outstanding:create',
      'finance:outstanding:read',
      'finance:outstanding:update',
      'finance:outstanding:delete',
      'finance:outstanding:approve',
      'finance:outstanding:list',
    ],
  };

  const restrictedPrincipal: any = {
    userId: 'user-guest-out-1',
    tenantId,
    roles: ['guest'],
    permissions: [],
  };

  const tenantBPrincipal: any = {
    userId: 'user-tenant-b-out',
    tenantId: tenantBId,
    roles: ['admin'],
    permissions: [
      'finance:outstanding:create',
      'finance:outstanding:read',
      'finance:outstanding:update',
      'finance:outstanding:delete',
      'finance:outstanding:approve',
      'finance:outstanding:list',
    ],
  };

  beforeEach(() => {
    OutstandingPgRepository.clearStore();
    OutstandingAuditService.clearAuditTrail();
    repository = new OutstandingPgRepository();
    createUseCase = new CreateOutstandingUseCase(repository);
    getUseCase = new GetOutstandingUseCase(repository);
    updateUseCase = new UpdateOutstandingUseCase(repository);
    listUseCase = new ListOutstandingsUseCase(repository);
    controller = new OutstandingController(repository);
  });

  // Task 1336: Domain Aggregate & Invariants
  describe('Task 1336: Outstanding Domain Entity & State Machine', () => {
    it('enforces invariants: tenantId, distributorId, outstandingReference, amountCents >= 0', () => {
      assert.throws(
        () => new Outstanding({ tenantId: '', distributorId, outstandingReference: 'OUT-1', amountCents: 100 }),
        /tenantId is required/
      );
      assert.throws(
        () => new Outstanding({ tenantId, distributorId: '', outstandingReference: 'OUT-1', amountCents: 100 }),
        /distributorId is required/
      );
      assert.throws(
        () => new Outstanding({ tenantId, distributorId, outstandingReference: '', amountCents: 100 }),
        /outstandingReference is required/
      );
      assert.throws(
        () => new Outstanding({ tenantId, distributorId, outstandingReference: 'OUT-NEG', amountCents: -50 }),
        /amountCents must be >= 0/
      );
    });

    it('executes valid state transitions (OPEN -> PARTIAL -> PAID) and rejects illegal ones', () => {
      const out = new Outstanding({
        tenantId,
        distributorId,
        outstandingReference: 'OUT-STATE-1',
        amountCents: 150000,
      });

      assert.strictEqual(out.status, 'OPEN');

      out.markPartial();
      assert.strictEqual(out.status, 'PARTIAL');
      assert.strictEqual(out.domainEvents.length, 1);

      out.markPaid();
      assert.strictEqual(out.status, 'PAID');
      assert.strictEqual(out.domainEvents.length, 2);

      // Illegal: PAID -> OPEN
      assert.throws(() => out.transitionTo('OPEN'), InvalidOutstandingStateTransitionError);
    });
  });

  // Task 1320 pattern: Domain Validation Rules
  describe('Outstanding Domain Validation Rules', () => {
    it('validates Create input and rejects unknown fields', () => {
      assert.throws(
        () => validateCreateOutstandingInput({ distributorId, outstandingReference: 'OUT-1', amountCents: 500, malicious: 'payload' }),
        /Unknown field 'malicious' is not allowed/
      );

      assert.throws(
        () => validateCreateOutstandingInput({ outstandingReference: 'OUT-1', amountCents: 500 }),
        /REQUIRED_FIELD: distributorId/
      );

      assert.throws(
        () => validateCreateOutstandingInput({ distributorId, outstandingReference: 'OUT-1', amountCents: -50 }),
        /INVALID_RANGE: amountCents/
      );
    });

    it('validates Update input and version field', () => {
      assert.throws(
        () => validateUpdateOutstandingInput({ status: 'PAID' }),
        /REQUIRED_FIELD: version is required/
      );
    });
  });

  // Tasks 1338-1340: Use Cases & Audit Trail
  describe('Tasks 1338-1340: Outstanding Use Cases & Audit Trail', () => {
    it('executes CreateOutstandingUseCase with idempotency, audit trail & uniqueness checks', async () => {
      const created = await createUseCase.execute(
        adminPrincipal,
        {
          distributorId,
          outstandingReference: 'OUT-2026-001',
          amountCents: 250000,
          dueDate: '2026-09-30T00:00:00.000Z',
        },
        'idemp-out-01',
        'corr-out-01'
      );

      assert.strictEqual(created.outstandingReference, 'OUT-2026-001');
      assert.strictEqual(created.amountCents, 250000);

      // Verify audit trail
      const auditTrail = OutstandingAuditService.getAuditTrail(tenantId);
      assert.strictEqual(auditTrail.length, 1);
      assert.strictEqual(auditTrail[0].action, 'OUTSTANDING_CREATED');
      assert.strictEqual(auditTrail[0].correlationId, 'corr-out-01');

      // Idempotency check
      const duplicateIdemp = await createUseCase.execute(
        adminPrincipal,
        {
          distributorId,
          outstandingReference: 'OUT-2026-001',
          amountCents: 250000,
        },
        'idemp-out-01'
      );
      assert.strictEqual(duplicateIdemp.id, created.id);

      // Duplicate outstandingReference throws conflict
      await assert.rejects(
        () =>
          createUseCase.execute(
            adminPrincipal,
            {
              distributorId,
              outstandingReference: 'OUT-2026-001',
              amountCents: 250000,
            },
            'idemp-out-02'
          ),
        /already exists/
      );
    });

    it('executes Get, Update and List use cases with optimistic locking', async () => {
      const created = await createUseCase.execute(adminPrincipal, {
        distributorId,
        outstandingReference: 'OUT-2026-002',
        amountCents: 180000,
      });

      // Get
      const fetched = await getUseCase.execute(adminPrincipal, created.id);
      assert.strictEqual(fetched.id, created.id);

      // Update -> PARTIAL (version 1)
      const updated = await updateUseCase.execute(adminPrincipal, created.id, {
        status: 'PARTIAL',
        version: 1,
      });
      assert.strictEqual(updated.status, 'PARTIAL');

      // Stale update fails
      await assert.rejects(
        () => updateUseCase.execute(adminPrincipal, created.id, { status: 'PAID', version: 1 }),
        /Version conflict/
      );

      // List
      const listRes = await listUseCase.execute(adminPrincipal, { page: 1, limit: 10 });
      assert.strictEqual(listRes.total, 1);
      assert.strictEqual(listRes.data[0].id, created.id);
    });

    it('rejects unauthorized principals', async () => {
      await assert.rejects(
        () =>
          createUseCase.execute(restrictedPrincipal, {
            distributorId,
            outstandingReference: 'OUT-UNAUTH',
            amountCents: 1000,
          }),
        /Forbidden: Insufficient permissions/
      );
    });
  });

  // Task 1337: Repository & Tenant RLS Isolation Proof
  describe('Task 1337: Repository RLS Isolation Proof', () => {
    it('enforces tenant RLS isolation between Tenant A and Tenant B', async () => {
      const outA = await createUseCase.execute(adminPrincipal, {
        distributorId,
        outstandingReference: 'OUT-TENANT-A',
        amountCents: 5000,
      });

      const outB = await createUseCase.execute(tenantBPrincipal, {
        distributorId,
        outstandingReference: 'OUT-TENANT-B',
        amountCents: 7500,
      });

      await assert.rejects(
        () => getUseCase.execute(adminPrincipal, outB.id),
        /Outstanding record with id .* not found/
      );

      await assert.rejects(
        () => getUseCase.execute(tenantBPrincipal, outA.id),
        /Outstanding record with id .* not found/
      );
    });
  });

  // Controller API Routes & Security Suite
  describe('Outstanding Controller REST API & Security', () => {
    it('handles controller CRUD endpoints with correct HTTP status codes', async () => {
      const headers = {
        'x-tenant-id': tenantId,
        'x-user-id': 'user-admin-out-1',
        'x-user-roles': 'admin',
        'content-type': 'application/json',
      };

      // 1. Create -> 201
      const createRes = await controller.handleCreate(
        {
          distributorId,
          outstandingReference: 'OUT-API-001',
          amountCents: 95000,
        },
        headers
      );
      assert.strictEqual(createRes.statusCode, 201);
      assert.strictEqual(createRes.body.success, true);
      const createdId = (createRes.body as any).outstanding.id;

      // 2. Get -> 200
      const getRes = await controller.handleGet(createdId, headers);
      assert.strictEqual(getRes.statusCode, 200);
      assert.strictEqual((getRes.body as any).outstanding.outstandingReference, 'OUT-API-001');

      // 3. Update -> 200
      const updateRes = await controller.handleUpdate(
        createdId,
        { status: 'PARTIAL', version: 1 },
        headers
      );
      assert.strictEqual(updateRes.statusCode, 200);
      assert.strictEqual((updateRes.body as any).outstanding.status, 'PARTIAL');

      // 4. List -> 200
      const listRes = await controller.handleList({ page: 1, limit: 10 }, headers);
      assert.strictEqual(listRes.statusCode, 200);
      assert.strictEqual((listRes.body as any).total, 1);
    });

    it('rejects unsupported content-type', async () => {
      const headersXml = {
        'x-tenant-id': tenantId,
        'content-type': 'application/xml',
      };

      const resXml = await controller.handleCreate(
        { distributorId, outstandingReference: 'OUT-XML', amountCents: 100 },
        headersXml
      );
      assert.strictEqual(resXml.statusCode, 415);
    });
  });
});
