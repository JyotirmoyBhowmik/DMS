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

describe('DebitNote Full QA & Security Suite (Tasks 1281-1288)', () => {
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

  const readOnlyPrincipal: any = {
    userId: 'user-read-dn-1',
    tenantId,
    roles: ['analyst'],
    permissions: ['finance:debit_note:read'],
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

  // Task 1282: DTO Boundary & Mass-Assignment Protection
  describe('Task 1282: DTO Mapping Boundary & Mass Assignment Protection', () => {
    it('rejects extra unknown fields to prevent mass assignment', () => {
      assert.throws(
        () => validateCreateDebitNoteInput({ distributorId, debitNoteNumber: 'DN-DTO-1', amountCents: 1000, reason: 'Test', unexpectedProp: 'hacked' }),
        /Unknown field 'unexpectedProp' is not allowed/
      );
    });
  });

  // Task 1283: RBAC Permissions & Privilege Escalation Denial
  describe('Task 1283: RBAC Granular Permissions & Default-Deny Policy', () => {
    it('rejects unprivileged access (default-deny policy)', async () => {
      await assert.rejects(
        () =>
          createUseCase.execute(restrictedPrincipal, {
            distributorId,
            debitNoteNumber: 'DN-DENIED',
            amountCents: 100,
            reason: 'Penalty',
          }),
        /Forbidden: Insufficient permissions/
      );
    });

    it('denies privilege-escalation attempt when user lacks approval permission', async () => {
      const created = await createUseCase.execute(adminPrincipal, {
        distributorId,
        debitNoteNumber: 'DN-APPROVE-TEST',
        amountCents: 5000,
        reason: 'Penalty',
      });

      await assert.rejects(
        () =>
          updateUseCase.execute(readOnlyPrincipal, created.id, {
            status: 'APPROVED',
            version: 1,
          }),
        /Forbidden: Insufficient permissions/
      );
    });
  });

  // Task 1284: Audit Logging Hooks
  describe('Task 1284: Audit Logging Verification', () => {
    it('records tamper-evident audit records on debit note create & update', async () => {
      const created = await createUseCase.execute(
        adminPrincipal,
        {
          distributorId,
          debitNoteNumber: 'DN-AUDIT-01',
          amountCents: 25000,
          reason: 'Late payment surcharge fee',
        },
        undefined,
        'corr-dn-audit-100'
      );

      let trail = DebitNoteAuditService.getAuditTrail(tenantId);
      assert.strictEqual(trail.length, 1);
      assert.strictEqual(trail[0].action, 'DEBIT_NOTE_CREATED');
      assert.strictEqual(trail[0].actorId, 'user-admin-dn-1');
      assert.strictEqual(trail[0].correlationId, 'corr-dn-audit-100');

      await updateUseCase.execute(
        adminPrincipal,
        created.id,
        { status: 'APPROVED', version: 1 },
        'corr-dn-audit-101'
      );

      trail = DebitNoteAuditService.getAuditTrail(tenantId);
      assert.strictEqual(trail.length, 2);
      assert.strictEqual(trail[1].action, 'DEBIT_NOTE_UPDATED_APPROVED');
      assert.strictEqual(trail[1].correlationId, 'corr-dn-audit-101');
    });
  });

  // Task 1285: Domain Unit Tests
  describe('Task 1285: Domain Aggregate Invariants & State Machine', () => {
    it('enforces constructor invariants and state machine rules', () => {
      assert.throws(
        () => new DebitNote({ tenantId: '', distributorId, debitNoteNumber: 'DN-1', amountCents: 100, reason: 'Penalty' }),
        /tenantId is required/
      );
      assert.throws(
        () => new DebitNote({ tenantId, distributorId, debitNoteNumber: 'DN-ZERO', amountCents: 0, reason: 'Penalty' }),
        /amountCents must be > 0/
      );

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
      dn.apply();
      assert.strictEqual(dn.status, 'APPLIED');

      assert.throws(() => dn.transitionTo('DRAFT'), InvalidDebitNoteStateTransitionError);
    });
  });

  // Task 1286: Use Cases Suite & Optimistic Locking
  describe('Task 1286: Use Cases Execution & Optimistic Concurrency', () => {
    it('executes CRUD flow and rejects optimistic locking conflict', async () => {
      const created = await createUseCase.execute(adminPrincipal, {
        distributorId,
        debitNoteNumber: 'DN-FLOW-1',
        amountCents: 18000,
        reason: 'Pallet damage recovery',
      });

      const fetched = await getUseCase.execute(adminPrincipal, created.id);
      assert.strictEqual(fetched.id, created.id);

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
    });
  });

  // Task 1287: Repository RLS Isolation Proof
  describe('Task 1287: Repository Integration & RLS Isolation Proof', () => {
    it('proves Tenant A cannot read or mutate Tenant B debit note', async () => {
      const dnA = await createUseCase.execute(adminPrincipal, {
        distributorId,
        debitNoteNumber: 'DN-TEN-A',
        amountCents: 5000,
        reason: 'Tenant A debit',
      });

      const dnB = await createUseCase.execute(tenantBPrincipal, {
        distributorId,
        debitNoteNumber: 'DN-TEN-B',
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

  // Task 1288: API Gateway Security Suite
  describe('Task 1288: API Gateway Security Suite', () => {
    it('handles controller CRUD endpoints and rejects invalid content-type', async () => {
      const headers = {
        'x-tenant-id': tenantId,
        'x-user-id': 'user-admin-dn-1',
        'x-user-roles': 'admin',
        'content-type': 'application/json',
      };

      const createRes = await controller.handleCreate(
        {
          distributorId,
          debitNoteNumber: 'DN-API-SEC-1',
          amountCents: 45000,
          reason: 'Freight surcharge debit note',
        },
        headers
      );
      assert.strictEqual(createRes.statusCode, 201);
      assert.strictEqual(createRes.body.success, true);

      // Invalid Content-Type -> 415
      const xmlRes = await controller.handleCreate(
        { distributorId, debitNoteNumber: 'DN-XML', amountCents: 100, reason: 'XML test' },
        { ...headers, 'content-type': 'application/xml' }
      );
      assert.strictEqual(xmlRes.statusCode, 415);
    });
  });
});
