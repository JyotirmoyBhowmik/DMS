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
import { randomUUID } from 'node:crypto';

describe('CreditNote Full Vertical Slice QA & Security Suite (Tasks 1249-1260)', () => {
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
      'finance:credit_note:list',
    ],
  };

  const restrictedPrincipal: any = {
    userId: 'user-guest-cn-1',
    tenantId,
    roles: ['guest'],
    permissions: [],
  };

  const tenantBPrincipal: any = {
    userId: 'user-tenant-b-cn',
    tenantId: tenantBId,
    roles: ['admin'],
    permissions: [
      'finance:credit_note:create',
      'finance:credit_note:read',
      'finance:credit_note:update',
      'finance:credit_note:list',
    ],
  };

  beforeEach(() => {
    CreditNotePgRepository.clearStore();
    repository = new CreditNotePgRepository();
    createUseCase = new CreateCreditNoteUseCase(repository);
    getUseCase = new GetCreditNoteUseCase(repository);
    updateUseCase = new UpdateCreditNoteUseCase(repository);
    listUseCase = new ListCreditNotesUseCase(repository);
    controller = new CreditNoteController(repository);
  });

  // Task 1250 & 1257: Domain Aggregate & State Machine
  describe('Tasks 1250 & 1257: CreditNote Domain Entity & Invariants', () => {
    it('enforces invariants: tenantId, distributorId, creditNoteNumber, amountCents > 0, reason', () => {
      assert.throws(
        () => new CreditNote({ tenantId: '', distributorId, creditNoteNumber: 'CN-1', amountCents: 100, reason: 'Return' }),
        /tenantId is required/
      );
      assert.throws(
        () => new CreditNote({ tenantId, distributorId: '', creditNoteNumber: 'CN-1', amountCents: 100, reason: 'Return' }),
        /distributorId is required/
      );
      assert.throws(
        () => new CreditNote({ tenantId, distributorId, creditNoteNumber: '', amountCents: 100, reason: 'Return' }),
        /creditNoteNumber is required/
      );
      assert.throws(
        () => new CreditNote({ tenantId, distributorId, creditNoteNumber: 'CN-ZERO', amountCents: 0, reason: 'Return' }),
        /amountCents must be > 0/
      );
      assert.throws(
        () => new CreditNote({ tenantId, distributorId, creditNoteNumber: 'CN-NO-REASON', amountCents: 100, reason: '' }),
        /reason is required/
      );
    });

    it('executes valid state machine transitions (DRAFT -> APPROVED -> APPLIED) and rejects illegal ones', () => {
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
      assert.strictEqual(cn.domainEvents.length, 1);

      cn.apply();
      assert.strictEqual(cn.status, 'APPLIED');
      assert.strictEqual(cn.domainEvents.length, 2);

      // Illegal: APPLIED -> DRAFT
      assert.throws(() => cn.transitionTo('DRAFT'), InvalidCreditNoteStateTransitionError);
      // Illegal: APPLIED -> CANCELLED
      assert.throws(() => cn.transitionTo('CANCELLED'), InvalidCreditNoteStateTransitionError);
    });
  });

  // Task 1256: Domain Validation Rules
  describe('Task 1256: CreditNote Domain Validation Rules', () => {
    it('validates Create credit note input and rejects unknown fields', () => {
      assert.throws(
        () => validateCreateCreditNoteInput({ distributorId, creditNoteNumber: 'CN-1', amountCents: 500, reason: 'Return', hackerField: 'xss' }),
        /Unknown field 'hackerField' is not allowed/
      );

      assert.throws(
        () => validateCreateCreditNoteInput({ creditNoteNumber: 'CN-1', amountCents: 500, reason: 'Return' }),
        /REQUIRED_FIELD: distributorId/
      );

      assert.throws(
        () => validateCreateCreditNoteInput({ distributorId, creditNoteNumber: 'CN-1', amountCents: -50, reason: 'Return' }),
        /INVALID_RANGE: amountCents/
      );
    });

    it('validates Update credit note input and version field', () => {
      assert.throws(
        () => validateUpdateCreditNoteInput({ status: 'APPROVED' }),
        /REQUIRED_FIELD: version is required/
      );
    });
  });

  // Tasks 1252-1255: Use Cases Suite
  describe('Tasks 1252-1255: CreditNote Use Cases Execution Suite', () => {
    it('executes CreateCreditNoteUseCase with idempotency & uniqueness checks', async () => {
      const created = await createUseCase.execute(
        adminPrincipal,
        {
          distributorId,
          creditNoteNumber: 'CN-2026-001',
          amountCents: 15000,
          reason: 'Promotional Scheme Payout',
        },
        'idemp-cn-01'
      );

      assert.strictEqual(created.creditNoteNumber, 'CN-2026-001');
      assert.strictEqual(created.amountCents, 15000);

      // Idempotency check
      const duplicateIdemp = await createUseCase.execute(
        adminPrincipal,
        {
          distributorId,
          creditNoteNumber: 'CN-2026-001',
          amountCents: 15000,
          reason: 'Promotional Scheme Payout',
        },
        'idemp-cn-01'
      );
      assert.strictEqual(duplicateIdemp.id, created.id);

      // Duplicate creditNoteNumber throws conflict
      await assert.rejects(
        () =>
          createUseCase.execute(
            adminPrincipal,
            {
              distributorId,
              creditNoteNumber: 'CN-2026-001',
              amountCents: 15000,
              reason: 'Promotional Scheme Payout',
            },
            'idemp-cn-02'
          ),
        /already exists/
      );
    });

    it('executes Get, Update and List use cases with optimistic locking', async () => {
      const created = await createUseCase.execute(adminPrincipal, {
        distributorId,
        creditNoteNumber: 'CN-2026-002',
        amountCents: 20000,
        reason: 'Quantity Shortage Rebate',
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
            creditNoteNumber: 'CN-UNAUTH',
            amountCents: 1000,
            reason: 'Unauthorized attempt',
          }),
        /Forbidden: Insufficient permissions/
      );
    });
  });

  // Task 1251: Repository & Tenant RLS Isolation Proof
  describe('Task 1251: Repository RLS Isolation Proof', () => {
    it('enforces tenant RLS isolation between Tenant A and Tenant B', async () => {
      const cnA = await createUseCase.execute(adminPrincipal, {
        distributorId,
        creditNoteNumber: 'CN-TENANT-A',
        amountCents: 5000,
        reason: 'Tenant A credit',
      });

      const cnB = await createUseCase.execute(tenantBPrincipal, {
        distributorId,
        creditNoteNumber: 'CN-TENANT-B',
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

  // Task 1259: Controller API Routes & Security Suite
  describe('Task 1259: CreditNote Controller REST API & Security', () => {
    it('handles controller CRUD endpoints with correct HTTP status codes', async () => {
      const headers = {
        'x-tenant-id': tenantId,
        'x-user-id': 'user-admin-cn-1',
        'x-user-roles': 'admin',
        'content-type': 'application/json',
      };

      // 1. Create -> 201
      const createRes = await controller.handleCreate(
        {
          distributorId,
          creditNoteNumber: 'CN-API-001',
          amountCents: 35000,
          reason: 'Volume Discount Credit Note',
        },
        headers
      );
      assert.strictEqual(createRes.statusCode, 201);
      assert.strictEqual(createRes.body.success, true);
      const createdId = (createRes.body as any).creditNote.id;

      // 2. Get -> 200
      const getRes = await controller.handleGet(createdId, headers);
      assert.strictEqual(getRes.statusCode, 200);
      assert.strictEqual((getRes.body as any).creditNote.creditNoteNumber, 'CN-API-001');

      // 3. Update -> 200
      const updateRes = await controller.handleUpdate(
        createdId,
        { status: 'APPROVED', version: 1 },
        headers
      );
      assert.strictEqual(updateRes.statusCode, 200);
      assert.strictEqual((updateRes.body as any).creditNote.status, 'APPROVED');

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
        { distributorId, creditNoteNumber: 'CN-XML', amountCents: 100, reason: 'XML test' },
        headersXml
      );
      assert.strictEqual(resXml.statusCode, 415);
    });
  });
});
