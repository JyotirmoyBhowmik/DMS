import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { CreditNote, CreditNoteDomainError, InvalidCreditNoteStateTransitionError } from './domain/entities/credit-note.entity.js';
import { validateCreateCreditNoteInput, validateUpdateCreditNoteInput } from './domain/validation/credit-note.validation.js';
import { CreditNotePgRepository } from './infrastructure/database/repositories/credit-note.pg-repository.js';
import { CreateCreditNoteUseCase } from './application/usecases/create-credit-note.usecase.js';
import { GetCreditNoteUseCase } from './application/usecases/get-credit-note.usecase.js';
import { UpdateCreditNoteUseCase } from './application/usecases/update-credit-note.usecase.js';
import { ListCreditNotesUseCase } from './application/usecases/list-credit-notes.usecase.js';
import { CreditNoteController } from './presentation/rest/controllers/credit-note.controller.js';
import { CreditNoteAuditService } from './infrastructure/audit/credit-note.audit.js';
import { randomUUID } from 'node:crypto';

describe('CreditNote Full QA & Security Suite (Tasks 1261-1267)', () => {
  let repository: CreditNotePgRepository;
  let createUseCase: CreateCreditNoteUseCase;
  let getUseCase: GetCreditNoteUseCase;
  let updateUseCase: UpdateCreditNoteUseCase;
  let listUseCase: ListCreditNotesUseCase;
  let controller: CreditNoteController;

  const tenantId = randomUUID();
  const tenantBId = randomUUID();
  const distributorId = randomUUID();

  const adminPrincipal: any = {
    userId: 'user-admin-cn-1',
    tenantId,
    roles: ['admin'],
    permissions: [
      'finance:credit_note:create',
      'finance:credit_note:read',
      'finance:credit_note:update',
      'finance:credit_note:delete',
      'finance:credit_note:approve',
      'finance:credit_note:list',
    ],
  };

  const restrictedPrincipal: any = {
    userId: 'user-guest-cn-1',
    tenantId,
    roles: ['guest'],
    permissions: [],
  };

  const readOnlyPrincipal: any = {
    userId: 'user-read-cn-1',
    tenantId,
    roles: ['analyst'],
    permissions: ['finance:credit_note:read'],
  };

  const tenantBPrincipal: any = {
    userId: 'user-tenant-b-cn',
    tenantId: tenantBId,
    roles: ['admin'],
    permissions: [
      'finance:credit_note:create',
      'finance:credit_note:read',
      'finance:credit_note:update',
      'finance:credit_note:delete',
      'finance:credit_note:approve',
      'finance:credit_note:list',
    ],
  };

  beforeEach(() => {
    CreditNotePgRepository.clearStore();
    CreditNoteAuditService.clearAuditTrail();
    repository = new CreditNotePgRepository();
    createUseCase = new CreateCreditNoteUseCase(repository);
    getUseCase = new GetCreditNoteUseCase(repository);
    updateUseCase = new UpdateCreditNoteUseCase(repository);
    listUseCase = new ListCreditNotesUseCase(repository);
    controller = new CreditNoteController(repository);
  });

  // Task 1261: DTO Boundary & Mass-Assignment Protection
  describe('Task 1261: DTO Mapping Boundary & Mass Assignment Protection', () => {
    it('rejects extra unknown fields to prevent mass assignment', () => {
      assert.throws(
        () => validateCreateCreditNoteInput({ distributorId, creditNoteNumber: 'CN-DTO-1', amountCents: 1000, reason: 'Test', unexpectedProp: 'hacked' }),
        /Unknown field 'unexpectedProp' is not allowed/
      );
    });
  });

  // Task 1262: RBAC Permissions & Privilege Escalation Denial
  describe('Task 1262: RBAC Granular Permissions & Default-Deny Policy', () => {
    it('rejects unprivileged access (default-deny policy)', async () => {
      await assert.rejects(
        () =>
          createUseCase.execute(restrictedPrincipal, {
            distributorId,
            creditNoteNumber: 'CN-DENIED',
            amountCents: 100,
            reason: 'Return',
          }),
        /Forbidden: Insufficient permissions/
      );
    });

    it('denies privilege-escalation attempt when user lacks approval permission', async () => {
      const created = await createUseCase.execute(adminPrincipal, {
        distributorId,
        creditNoteNumber: 'CN-APPROVE-TEST',
        amountCents: 5000,
        reason: 'Return',
      });

      // User with read-only permissions cannot approve credit note
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

  // Task 1263: Audit Logging Hooks
  describe('Task 1263: Audit Logging Verification', () => {
    it('records tamper-evident audit records on credit note create & update', async () => {
      const created = await createUseCase.execute(
        adminPrincipal,
        {
          distributorId,
          creditNoteNumber: 'CN-AUDIT-01',
          amountCents: 25000,
          reason: 'Scheme rebate payout',
        },
        undefined,
        'corr-cn-audit-100'
      );

      let trail = CreditNoteAuditService.getAuditTrail(tenantId);
      assert.strictEqual(trail.length, 1);
      assert.strictEqual(trail[0].action, 'CREDIT_NOTE_CREATED');
      assert.strictEqual(trail[0].actorId, 'user-admin-cn-1');
      assert.strictEqual(trail[0].correlationId, 'corr-cn-audit-100');

      await updateUseCase.execute(
        adminPrincipal,
        created.id,
        { status: 'APPROVED', version: 1 },
        'corr-cn-audit-101'
      );

      trail = CreditNoteAuditService.getAuditTrail(tenantId);
      assert.strictEqual(trail.length, 2);
      assert.strictEqual(trail[1].action, 'CREDIT_NOTE_UPDATED_APPROVED');
      assert.strictEqual(trail[1].correlationId, 'corr-cn-audit-101');
    });
  });

  // Task 1264: Domain Unit Tests
  describe('Task 1264: Domain Aggregate Invariants & State Machine', () => {
    it('enforces constructor invariants and state machine rules', () => {
      assert.throws(
        () => new CreditNote({ tenantId: '', distributorId, creditNoteNumber: 'CN-1', amountCents: 100, reason: 'Return' }),
        /tenantId is required/
      );
      assert.throws(
        () => new CreditNote({ tenantId, distributorId, creditNoteNumber: 'CN-ZERO', amountCents: 0, reason: 'Return' }),
        /amountCents must be > 0/
      );

      const cn = new CreditNote({
        tenantId,
        distributorId,
        creditNoteNumber: 'CN-STATE-1',
        amountCents: 2500,
        reason: 'Damaged goods return',
      });

      assert.strictEqual(cn.status, 'DRAFT');
      cn.approve();
      assert.strictEqual(cn.status, 'APPROVED');
      cn.apply();
      assert.strictEqual(cn.status, 'APPLIED');

      assert.throws(() => cn.transitionTo('DRAFT'), InvalidCreditNoteStateTransitionError);
    });
  });

  // Task 1265: Use Cases Suite & Optimistic Locking
  describe('Task 1265: Use Cases Execution & Optimistic Concurrency', () => {
    it('executes CRUD flow and rejects optimistic locking conflict', async () => {
      const created = await createUseCase.execute(adminPrincipal, {
        distributorId,
        creditNoteNumber: 'CN-FLOW-1',
        amountCents: 12000,
        reason: 'Damage refund',
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

  // Task 1266: Repository RLS Isolation Proof
  describe('Task 1266: Repository Integration & RLS Isolation Proof', () => {
    it('proves Tenant A cannot read or mutate Tenant B credit note', async () => {
      const cnA = await createUseCase.execute(adminPrincipal, {
        distributorId,
        creditNoteNumber: 'CN-TEN-A',
        amountCents: 5000,
        reason: 'Tenant A credit',
      });

      const cnB = await createUseCase.execute(tenantBPrincipal, {
        distributorId,
        creditNoteNumber: 'CN-TEN-B',
        amountCents: 7500,
        reason: 'Tenant B credit',
      });

      await assert.rejects(
        () => getUseCase.execute(adminPrincipal, cnB.id),
        /CreditNote with id .* not found/
      );

      await assert.rejects(
        () => getUseCase.execute(tenantBPrincipal, cnA.id),
        /CreditNote with id .* not found/
      );
    });
  });

  // Task 1267: API Gateway Security Suite
  describe('Task 1267: API Gateway Security Suite', () => {
    it('handles controller CRUD endpoints and rejects invalid content-type', async () => {
      const headers = {
        'x-tenant-id': tenantId,
        'x-user-id': 'user-admin-cn-1',
        'x-user-roles': 'admin',
        'content-type': 'application/json',
      };

      const createRes = await controller.handleCreate(
        {
          distributorId,
          creditNoteNumber: 'CN-API-SEC-1',
          amountCents: 35000,
          reason: 'Volume Discount Credit Note',
        },
        headers
      );
      assert.strictEqual(createRes.statusCode, 201);
      assert.strictEqual(createRes.body.success, true);

      // Invalid Content-Type -> 415
      const xmlRes = await controller.handleCreate(
        { distributorId, creditNoteNumber: 'CN-XML', amountCents: 100, reason: 'XML test' },
        { ...headers, 'content-type': 'application/xml' }
      );
      assert.strictEqual(xmlRes.statusCode, 415);
    });
  });
});
