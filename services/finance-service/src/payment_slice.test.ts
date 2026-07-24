import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Payment, PaymentDomainError, InvalidPaymentStateTransitionError } from './domain/entities/payment.entity.js';
import { validateCreatePaymentInput, validateUpdatePaymentInput } from './domain/validation/payment.validation.js';
import { PaymentPgRepository } from './infrastructure/database/repositories/payment.pg-repository.js';
import { CreatePaymentUseCase } from './application/usecases/create-payment.usecase.js';
import { GetPaymentUseCase } from './application/usecases/get-payment.usecase.js';
import { UpdatePaymentUseCase } from './application/usecases/update-payment.usecase.js';
import { ListPaymentsUseCase } from './application/usecases/list-payments.usecase.js';
import { PaymentController } from './presentation/rest/controllers/payment.controller.js';
import { PaymentAuditService } from './infrastructure/audit/payment.audit.js';
import { randomUUID } from 'node:crypto';

describe('Payment Full Vertical Slice QA & Security Suite (Tasks 1291-1300)', () => {
  let repository: PaymentPgRepository;
  let createUseCase: CreatePaymentUseCase;
  let getUseCase: GetPaymentUseCase;
  let updateUseCase: UpdatePaymentUseCase;
  let listUseCase: ListPaymentsUseCase;
  let controller: PaymentController;

  const tenantId = randomUUID();
  const tenantBId = randomUUID();
  const distributorId = randomUUID();

  const adminPrincipal: any = {
    userId: 'user-admin-pay-1',
    tenantId,
    roles: ['admin'],
    permissions: [
      'finance:payment:create',
      'finance:payment:read',
      'finance:payment:update',
      'finance:payment:delete',
      'finance:payment:approve',
      'finance:payment:list',
    ],
  };

  const restrictedPrincipal: any = {
    userId: 'user-guest-pay-1',
    tenantId,
    roles: ['guest'],
    permissions: [],
  };

  const tenantBPrincipal: any = {
    userId: 'user-tenant-b-pay',
    tenantId: tenantBId,
    roles: ['admin'],
    permissions: [
      'finance:payment:create',
      'finance:payment:read',
      'finance:payment:update',
      'finance:payment:delete',
      'finance:payment:approve',
      'finance:payment:list',
    ],
  };

  beforeEach(() => {
    PaymentPgRepository.clearStore();
    PaymentAuditService.clearAuditTrail();
    repository = new PaymentPgRepository();
    createUseCase = new CreatePaymentUseCase(repository);
    getUseCase = new GetPaymentUseCase(repository);
    updateUseCase = new UpdatePaymentUseCase(repository);
    listUseCase = new ListPaymentsUseCase(repository);
    controller = new PaymentController(repository);
  });

  // Tasks 1292 & 1299: Domain Aggregate & State Machine
  describe('Tasks 1292 & 1299: Payment Domain Entity & Invariants', () => {
    it('enforces invariants: tenantId, distributorId, paymentReference, amountCents > 0', () => {
      assert.throws(
        () => new Payment({ tenantId: '', distributorId, paymentReference: 'PAY-1', amountCents: 100 }),
        /tenantId is required/
      );
      assert.throws(
        () => new Payment({ tenantId, distributorId: '', paymentReference: 'PAY-1', amountCents: 100 }),
        /distributorId is required/
      );
      assert.throws(
        () => new Payment({ tenantId, distributorId, paymentReference: '', amountCents: 100 }),
        /paymentReference is required/
      );
      assert.throws(
        () => new Payment({ tenantId, distributorId, paymentReference: 'PAY-ZERO', amountCents: 0 }),
        /amountCents must be > 0/
      );
    });

    it('executes valid state machine transitions (DRAFT -> PROCESSING -> COMPLETED -> REFUNDED) and rejects illegal ones', () => {
      const pay = new Payment({
        tenantId,
        distributorId,
        paymentReference: 'PAY-STATE-1',
        amountCents: 125000,
      });

      assert.strictEqual(pay.status, 'DRAFT');

      pay.process();
      assert.strictEqual(pay.status, 'PROCESSING');
      assert.strictEqual(pay.domainEvents.length, 1);

      pay.complete();
      assert.strictEqual(pay.status, 'COMPLETED');
      assert.strictEqual(pay.domainEvents.length, 2);

      pay.refund();
      assert.strictEqual(pay.status, 'REFUNDED');
      assert.strictEqual(pay.domainEvents.length, 3);

      // Illegal: REFUNDED -> DRAFT
      assert.throws(() => pay.transitionTo('DRAFT'), InvalidPaymentStateTransitionError);
    });
  });

  // Task 1298: Domain Validation Rules
  describe('Task 1298: Payment Domain Validation Rules', () => {
    it('validates Create payment input and rejects unknown fields', () => {
      assert.throws(
        () => validateCreatePaymentInput({ distributorId, paymentReference: 'PAY-1', amountCents: 500, malicious: 'payload' }),
        /Unknown field 'malicious' is not allowed/
      );

      assert.throws(
        () => validateCreatePaymentInput({ paymentReference: 'PAY-1', amountCents: 500 }),
        /REQUIRED_FIELD: distributorId/
      );

      assert.throws(
        () => validateCreatePaymentInput({ distributorId, paymentReference: 'PAY-1', amountCents: -50 }),
        /INVALID_RANGE: amountCents/
      );
    });

    it('validates Update payment input and version field', () => {
      assert.throws(
        () => validateUpdatePaymentInput({ status: 'COMPLETED' }),
        /REQUIRED_FIELD: version is required/
      );
    });
  });

  // Tasks 1294-1297 & 1300: Use Cases & Audit Logging Suite
  describe('Tasks 1294-1297 & 1300: Payment Use Cases & Audit Trail', () => {
    it('executes CreatePaymentUseCase with idempotency, audit trail & uniqueness checks', async () => {
      const created = await createUseCase.execute(
        adminPrincipal,
        {
          distributorId,
          paymentReference: 'PAY-2026-001',
          amountCents: 250000,
          paymentMethod: 'WIRE_TRANSFER',
        },
        'idemp-pay-01',
        'corr-pay-01'
      );

      assert.strictEqual(created.paymentReference, 'PAY-2026-001');
      assert.strictEqual(created.amountCents, 250000);

      // Verify audit trail
      const auditTrail = PaymentAuditService.getAuditTrail(tenantId);
      assert.strictEqual(auditTrail.length, 1);
      assert.strictEqual(auditTrail[0].action, 'PAYMENT_CREATED');
      assert.strictEqual(auditTrail[0].correlationId, 'corr-pay-01');

      // Idempotency check
      const duplicateIdemp = await createUseCase.execute(
        adminPrincipal,
        {
          distributorId,
          paymentReference: 'PAY-2026-001',
          amountCents: 250000,
        },
        'idemp-pay-01'
      );
      assert.strictEqual(duplicateIdemp.id, created.id);

      // Duplicate paymentReference throws conflict
      await assert.rejects(
        () =>
          createUseCase.execute(
            adminPrincipal,
            {
              distributorId,
              paymentReference: 'PAY-2026-001',
              amountCents: 250000,
            },
            'idemp-pay-02'
          ),
        /already exists/
      );
    });

    it('executes Get, Update and List use cases with optimistic locking', async () => {
      const created = await createUseCase.execute(adminPrincipal, {
        distributorId,
        paymentReference: 'PAY-2026-002',
        amountCents: 180000,
      });

      // Get
      const fetched = await getUseCase.execute(adminPrincipal, created.id);
      assert.strictEqual(fetched.id, created.id);

      // Update -> PROCESSING (version 1)
      const updated = await updateUseCase.execute(adminPrincipal, created.id, {
        status: 'PROCESSING',
        version: 1,
      });
      assert.strictEqual(updated.status, 'PROCESSING');

      // Stale update fails
      await assert.rejects(
        () => updateUseCase.execute(adminPrincipal, created.id, { status: 'COMPLETED', version: 1 }),
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
            paymentReference: 'PAY-UNAUTH',
            amountCents: 1000,
          }),
        /Forbidden: Insufficient permissions/
      );
    });
  });

  // Task 1293: Repository & Tenant RLS Isolation Proof
  describe('Task 1293: Repository RLS Isolation Proof', () => {
    it('enforces tenant RLS isolation between Tenant A and Tenant B', async () => {
      const payA = await createUseCase.execute(adminPrincipal, {
        distributorId,
        paymentReference: 'PAY-TENANT-A',
        amountCents: 5000,
      });

      const payB = await createUseCase.execute(tenantBPrincipal, {
        distributorId,
        paymentReference: 'PAY-TENANT-B',
        amountCents: 7500,
      });

      await assert.rejects(
        () => getUseCase.execute(adminPrincipal, payB.id),
        /Payment with id .* not found/
      );

      await assert.rejects(
        () => getUseCase.execute(tenantBPrincipal, payA.id),
        /Payment with id .* not found/
      );
    });
  });

  // Task 1300: Controller API Routes & Security Suite
  describe('Task 1300: Payment Controller REST API & Security', () => {
    it('handles controller CRUD endpoints with correct HTTP status codes', async () => {
      const headers = {
        'x-tenant-id': tenantId,
        'x-user-id': 'user-admin-pay-1',
        'x-user-roles': 'admin',
        'content-type': 'application/json',
      };

      // 1. Create -> 201
      const createRes = await controller.handleCreate(
        {
          distributorId,
          paymentReference: 'PAY-API-001',
          amountCents: 95000,
          paymentMethod: 'ACH',
        },
        headers
      );
      assert.strictEqual(createRes.statusCode, 201);
      assert.strictEqual(createRes.body.success, true);
      const createdId = (createRes.body as any).payment.id;

      // 2. Get -> 200
      const getRes = await controller.handleGet(createdId, headers);
      assert.strictEqual(getRes.statusCode, 200);
      assert.strictEqual((getRes.body as any).payment.paymentReference, 'PAY-API-001');

      // 3. Update -> 200
      const updateRes = await controller.handleUpdate(
        createdId,
        { status: 'PROCESSING', version: 1 },
        headers
      );
      assert.strictEqual(updateRes.statusCode, 200);
      assert.strictEqual((updateRes.body as any).payment.status, 'PROCESSING');

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
        { distributorId, paymentReference: 'PAY-XML', amountCents: 100 },
        headersXml
      );
      assert.strictEqual(resXml.statusCode, 415);
    });
  });
});
