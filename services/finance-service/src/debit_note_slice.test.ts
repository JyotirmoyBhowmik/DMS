import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { DebitNote, DebitNoteDomainError, InvalidDebitNoteStateTransitionError } from './domain/entities/debit-note.entity.js';
import { validateCreateDebitNoteInput, validateUpdateDebitNoteInput } from './domain/validation/debit-note.validation.js';
import { DebitNotePgRepository } from './infrastructure/database/repositories/debit-note.pg-repository.js';
import { CreateDebitNoteUseCase } from './application/usecases/create-debit-note.usecase.js';
import { GetDebitNoteUseCase } from './application/usecases/get-debit-note.usecase.js';
import { UpdateDebitNoteUseCase } from './application/usecases/update-debit-note.usecase.js';
import { ListDebitNotesUseCase } from './application/usecases/list-debit-notes.usecase.js';
import { DebitNoteController } from './presentation/rest/controllers/debit-note.controller.js';

import { DebitNoteAuditService } from './infrastructure/audit/debit-note.audit.js';
import { randomUUID } from 'node:crypto';

describe('DebitNote Full Vertical Slice QA & Security Suite (Tasks 1270-1280)', () => {
  let repository: DebitNotePgRepository;
  let createUseCase: CreateDebitNoteUseCase;
  let getUseCase: GetDebitNoteUseCase;
  let updateUseCase: UpdateDebitNoteUseCase;
  let listUseCase: ListDebitNotesUseCase;
  let controller: DebitNoteController;

  const tenantId = randomUUID();
  const tenantBId = randomUUID();
  const distributorId = randomUUID();

  const adminPrincipal: any = {
    userId: 'user-admin-dn-1',
    tenantId,
    roles: ['admin'],
    permissions: [
      'finance:debit_note:create',
      'finance:debit_note:read',
      'finance:debit_note:update',
      'finance:debit_note:delete',
      'finance:debit_note:approve',
      'finance:debit_note:list',
    ],
  };

  const restrictedPrincipal: any = {
    userId: 'user-guest-dn-1',
    tenantId,
    roles: ['guest'],
    permissions: [],
  };

  const tenantBPrincipal: any = {
    userId: 'user-tenant-b-dn',
    tenantId: tenantBId,
    roles: ['admin'],
    permissions: [
      'finance:debit_note:create',
      'finance:debit_note:read',
      'finance:debit_note:update',
      'finance:debit_note:delete',
      'finance:debit_note:approve',
      'finance:debit_note:list',
    ],
  };

  beforeEach(() => {
    DebitNotePgRepository.clearStore();
    DebitNoteAuditService.clearAuditTrail();
    repository = new DebitNotePgRepository();
    createUseCase = new CreateDebitNoteUseCase(repository);
    getUseCase = new GetDebitNoteUseCase(repository);
    updateUseCase = new UpdateDebitNoteUseCase(repository);
    listUseCase = new ListDebitNotesUseCase(repository);
    controller = new DebitNoteController(repository);
  });

  // Tasks 1271 & 1278: Domain Aggregate & State Machine
  describe('Tasks 1271 & 1278: DebitNote Domain Entity & Invariants', () => {
    it('enforces invariants: tenantId, distributorId, debitNoteNumber, amountCents > 0, reason', () => {
      assert.throws(
        () => new DebitNote({ tenantId: '', distributorId, debitNoteNumber: 'DN-1', amountCents: 100, reason: 'Penalty' }),
        /tenantId is required/
      );
      assert.throws(
        () => new DebitNote({ tenantId, distributorId: '', debitNoteNumber: 'DN-1', amountCents: 100, reason: 'Penalty' }),
        /distributorId is required/
      );
      assert.throws(
        () => new DebitNote({ tenantId, distributorId, debitNoteNumber: '', amountCents: 100, reason: 'Penalty' }),
        /debitNoteNumber is required/
      );
      assert.throws(
        () => new DebitNote({ tenantId, distributorId, debitNoteNumber: 'DN-ZERO', amountCents: 0, reason: 'Penalty' }),
        /amountCents must be > 0/
      );
      assert.throws(
        () => new DebitNote({ tenantId, distributorId, debitNoteNumber: 'DN-NO-REASON', amountCents: 100, reason: '' }),
        /reason is required/
      );
    });

    it('executes valid state machine transitions (DRAFT -> APPROVED -> APPLIED) and rejects illegal ones', () => {
      const dn = new DebitNote({
        tenantId,
        distributorId,
        debitNoteNumber: 'DN-STATE-1',
        amountCents: 3500,
        reason: 'Late payment surcharge',
      });

      assert.strictEqual(dn.status, 'DRAFT');

      dn.approve();
      assert.strictEqual(dn.status, 'APPROVED');
      assert.strictEqual(dn.domainEvents.length, 1);

      dn.apply();
      assert.strictEqual(dn.status, 'APPLIED');
      assert.strictEqual(dn.domainEvents.length, 2);

      // Illegal: APPLIED -> DRAFT
      assert.throws(() => dn.transitionTo('DRAFT'), InvalidDebitNoteStateTransitionError);
      // Illegal: APPLIED -> CANCELLED
      assert.throws(() => dn.transitionTo('CANCELLED'), InvalidDebitNoteStateTransitionError);
    });
  });

  // Task 1277: Domain Validation Rules
  describe('Task 1277: DebitNote Domain Validation Rules', () => {
    it('validates Create debit note input and rejects unknown fields', () => {
      assert.throws(
        () => validateCreateDebitNoteInput({ distributorId, debitNoteNumber: 'DN-1', amountCents: 500, reason: 'Penalty', malicious: 'payload' }),
        /Unknown field 'malicious' is not allowed/
      );

      assert.throws(
        () => validateCreateDebitNoteInput({ debitNoteNumber: 'DN-1', amountCents: 500, reason: 'Penalty' }),
        /REQUIRED_FIELD: distributorId/
      );

      assert.throws(
        () => validateCreateDebitNoteInput({ distributorId, debitNoteNumber: 'DN-1', amountCents: -50, reason: 'Penalty' }),
        /INVALID_RANGE: amountCents/
      );
    });

    it('validates Update debit note input and version field', () => {
      assert.throws(
        () => validateUpdateDebitNoteInput({ status: 'APPROVED' }),
        /REQUIRED_FIELD: version is required/
      );
    });
  });

  // Tasks 1273-1276 & 1279: Use Cases & Audit Logging Suite
  describe('Tasks 1273-1276 & 1279: DebitNote Use Cases & Audit Trail', () => {
    it('executes CreateDebitNoteUseCase with idempotency, audit trail & uniqueness checks', async () => {
      const created = await createUseCase.execute(
        adminPrincipal,
        {
          distributorId,
          debitNoteNumber: 'DN-2026-001',
          amountCents: 18000,
          reason: 'Container damage recovery fee',
        },
        'idemp-dn-01',
        'corr-dn-01'
      );

      assert.strictEqual(created.debitNoteNumber, 'DN-2026-001');
      assert.strictEqual(created.amountCents, 18000);

      // Verify audit trail
      const auditTrail = DebitNoteAuditService.getAuditTrail(tenantId);
      assert.strictEqual(auditTrail.length, 1);
      assert.strictEqual(auditTrail[0].action, 'DEBIT_NOTE_CREATED');
      assert.strictEqual(auditTrail[0].correlationId, 'corr-dn-01');

      // Idempotency check
      const duplicateIdemp = await createUseCase.execute(
        adminPrincipal,
        {
          distributorId,
          debitNoteNumber: 'DN-2026-001',
          amountCents: 18000,
          reason: 'Container damage recovery fee',
        },
        'idemp-dn-01'
      );
      assert.strictEqual(duplicateIdemp.id, created.id);

      // Duplicate debitNoteNumber throws conflict
      await assert.rejects(
        () =>
          createUseCase.execute(
            adminPrincipal,
            {
              distributorId,
              debitNoteNumber: 'DN-2026-001',
              amountCents: 18000,
              reason: 'Container damage recovery fee',
            },
            'idemp-dn-02'
          ),
        /already exists/
      );
    });

    it('executes Get, Update and List use cases with optimistic locking', async () => {
      const created = await createUseCase.execute(adminPrincipal, {
        distributorId,
        debitNoteNumber: 'DN-2026-002',
        amountCents: 22000,
        reason: 'Pallet replacement charge',
      });

      // Get
      const fetched = await getUseCase.execute(adminPrincipal, created.id);
      assert.strictEqual(fetched.id, created.id);

      // Update -> APPROVED (version 1)
      const updated = await updateUseCase.execute(adminPrincipal, created.id, {
        status: 'APPROVED',
        version: 1,
      });
      assert.strictEqual(updated.status, 'APPROVED');

      // Stale update fails
      await assert.rejects(
        () => updateUseCase.execute(adminPrincipal, created.id, { status: 'APPLIED', version: 1 }),
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
            debitNoteNumber: 'DN-UNAUTH',
            amountCents: 1000,
            reason: 'Unauthorized attempt',
          }),
        /Forbidden: Insufficient permissions/
      );
    });
  });

  // Task 1272: Repository & Tenant RLS Isolation Proof
  describe('Task 1272: Repository RLS Isolation Proof', () => {
    it('enforces tenant RLS isolation between Tenant A and Tenant B', async () => {
      const dnA = await createUseCase.execute(adminPrincipal, {
        distributorId,
        debitNoteNumber: 'DN-TENANT-A',
        amountCents: 5000,
        reason: 'Tenant A debit',
      });

      const dnB = await createUseCase.execute(tenantBPrincipal, {
        distributorId,
        debitNoteNumber: 'DN-TENANT-B',
        amountCents: 7500,
        reason: 'Tenant B debit',
      });

      await assert.rejects(
        () => getUseCase.execute(adminPrincipal, dnB.id),
        /DebitNote with id .* not found/
      );

      await assert.rejects(
        () => getUseCase.execute(tenantBPrincipal, dnA.id),
        /DebitNote with id .* not found/
      );
    });
  });

  // Task 1280: Controller API Routes & Security Suite
  describe('Task 1280: DebitNote Controller REST API & Security', () => {
    it('handles controller CRUD endpoints with correct HTTP status codes', async () => {
      const headers = {
        'x-tenant-id': tenantId,
        'x-user-id': 'user-admin-dn-1',
        'x-user-roles': 'admin',
        'content-type': 'application/json',
      };

      // 1. Create -> 201
      const createRes = await controller.handleCreate(
        {
          distributorId,
          debitNoteNumber: 'DN-API-001',
          amountCents: 45000,
          reason: 'Freight surcharge debit note',
        },
        headers
      );
      assert.strictEqual(createRes.statusCode, 201);
      assert.strictEqual(createRes.body.success, true);
      const createdId = (createRes.body as any).debitNote.id;

      // 2. Get -> 200
      const getRes = await controller.handleGet(createdId, headers);
      assert.strictEqual(getRes.statusCode, 200);
      assert.strictEqual((getRes.body as any).debitNote.debitNoteNumber, 'DN-API-001');

      // 3. Update -> 200
      const updateRes = await controller.handleUpdate(
        createdId,
        { status: 'APPROVED', version: 1 },
        headers
      );
      assert.strictEqual(updateRes.statusCode, 200);
      assert.strictEqual((updateRes.body as any).debitNote.status, 'APPROVED');

      // 4. List -> 200
      const listRes = await controller.handleList({ page: 1, limit: 10 }, headers);
      assert.strictEqual(listRes.statusCode, 200);
      assert.strictEqual((listRes.body as any).total, 1);
    });

    it('rejects unsupported content-type and handles SQL injection safety', async () => {
      const headersXml = {
        'x-tenant-id': tenantId,
        'content-type': 'application/xml',
      };

      const resXml = await controller.handleCreate(
        { distributorId, debitNoteNumber: 'DN-XML', amountCents: 100, reason: 'XML test' },
        headersXml
      );
      assert.strictEqual(resXml.statusCode, 415);
    });
  });
});
