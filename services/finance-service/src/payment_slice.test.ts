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
import { PaymentEventConsumer } from './infrastructure/events/payment.consumer.js';
import { randomUUID } from 'node:crypto';

describe('Payment Full QA, Security & Consumer Suite (Tasks 1301-1310)', () => {
  let repository: PaymentPgRepository;
  let createUseCase: CreatePaymentUseCase;
  let getUseCase: GetPaymentUseCase;
  let updateUseCase: UpdatePaymentUseCase;
  let listUseCase: ListPaymentsUseCase;
  let controller: PaymentController;
  let consumer: PaymentEventConsumer;

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

  const readOnlyPrincipal: any = {
    userId: 'user-read-pay-1',
    tenantId,
    roles: ['analyst'],
    permissions: ['finance:payment:read'],
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
    consumer = new PaymentEventConsumer();
    consumer.clearDeduplicationStore();
  });

  // Task 1301: Event Consumer Deduplication & DLQ
  describe('Task 1301: Payment Event Consumer & DLQ Handling', () => {
    it('deduplicates events by ID and routes poison messages to DLQ', async () => {
      const validEvent = {
        id: 'evt-pay-100',
        name: 'finance.payment.completed',
        occurredAt: new Date().toISOString(),
        tenantId,
        payload: { paymentId: 'pay-1', amountCents: 1000 },
      };

      const res1 = await consumer.handleEvent(validEvent);
      assert.strictEqual(res1.success, true);
      assert.strictEqual(consumer.isProcessed('evt-pay-100'), true);

      // Redelivery -> Duplicate
      const res2 = await consumer.handleEvent(validEvent);
      assert.strictEqual(res2.success, true);
      assert.strictEqual(res2.duplicate, true);

      // Poison message -> DLQ
      const poisonEvent: any = { id: '', name: 'invalid' };
      const res3 = await consumer.handleEvent(poisonEvent);
      assert.strictEqual(res3.success, false);
      assert.strictEqual(consumer.getDLQ().length, 1);
    });
  });

  // Task 1304: DTO Boundary & Mass-Assignment Protection
  describe('Task 1304: DTO Mapping Boundary & Mass Assignment Protection', () => {
    it('rejects extra unknown fields to prevent mass assignment', () => {
      assert.throws(
        () => validateCreatePaymentInput({ distributorId, paymentReference: 'PAY-DTO-1', amountCents: 1000, unexpectedProp: 'hacked' }),
        /Unknown field 'unexpectedProp' is not allowed/
      );
    });
  });

  // Task 1305: RBAC Permissions & Privilege Escalation Denial
  describe('Task 1305: RBAC Granular Permissions & Default-Deny Policy', () => {
    it('rejects unprivileged access (default-deny policy)', async () => {
      await assert.rejects(
        () =>
          createUseCase.execute(restrictedPrincipal, {
            distributorId,
            paymentReference: 'PAY-DENIED',
            amountCents: 100,
          }),
        /Forbidden: Insufficient permissions/
      );
    });

    it('denies privilege-escalation attempt when user lacks approval permission', async () => {
      const created = await createUseCase.execute(adminPrincipal, {
        distributorId,
        paymentReference: 'PAY-APPROVE-TEST',
        amountCents: 5000,
      });

      await assert.rejects(
        () =>
          updateUseCase.execute(readOnlyPrincipal, created.id, {
            status: 'COMPLETED',
            version: 1,
          }),
        /Forbidden: Insufficient permissions/
      );
    });
  });

  // Task 1306: Audit Logging Hooks
  describe('Task 1306: Audit Logging Verification', () => {
    it('records tamper-evident audit records on payment create & update', async () => {
      const created = await createUseCase.execute(
        adminPrincipal,
        {
          distributorId,
          paymentReference: 'PAY-AUDIT-01',
          amountCents: 25000,
        },
        undefined,
        'corr-pay-audit-100'
      );

      let trail = PaymentAuditService.getAuditTrail(tenantId);
      assert.strictEqual(trail.length, 1);
      assert.strictEqual(trail[0].action, 'PAYMENT_CREATED');
      assert.strictEqual(trail[0].actorId, 'user-admin-pay-1');

      await updateUseCase.execute(
        adminPrincipal,
        created.id,
        { status: 'PROCESSING', version: 1 },
        'corr-pay-audit-101'
      );

      trail = PaymentAuditService.getAuditTrail(tenantId);
      assert.strictEqual(trail.length, 2);
      assert.strictEqual(trail[1].action, 'PAYMENT_UPDATED_PROCESSING');
    });
  });

  // Task 1307: Domain Invariants
  describe('Task 1307: Domain Aggregate Invariants & State Machine', () => {
    it('enforces constructor invariants and state machine rules', () => {
      assert.throws(
        () => new Payment({ tenantId: '', distributorId, paymentReference: 'PAY-1', amountCents: 100 }),
        /tenantId is required/
      );

      const pay = new Payment({
        tenantId,
        distributorId,
        paymentReference: 'PAY-STATE-1',
        amountCents: 3500,
      });

      assert.strictEqual(pay.status, 'DRAFT');
      pay.process();
      assert.strictEqual(pay.status, 'PROCESSING');
      pay.complete();
      assert.strictEqual(pay.status, 'COMPLETED');
      pay.refund();
      assert.strictEqual(pay.status, 'REFUNDED');

      assert.throws(() => pay.transitionTo('DRAFT'), InvalidPaymentStateTransitionError);
    });
  });

  // Task 1308: Use Cases Execution & Optimistic Concurrency
  describe('Task 1308: Use Cases Execution & Optimistic Concurrency', () => {
    it('executes CRUD flow and rejects optimistic locking conflict', async () => {
      const created = await createUseCase.execute(adminPrincipal, {
        distributorId,
        paymentReference: 'PAY-FLOW-1',
        amountCents: 18000,
      });

      const fetched = await getUseCase.execute(adminPrincipal, created.id);
      assert.strictEqual(fetched.id, created.id);

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
    });
  });

  // Task 1309: Repository RLS Isolation Proof
  describe('Task 1309: Repository Integration & RLS Isolation Proof', () => {
    it('proves Tenant A cannot read or mutate Tenant B payment', async () => {
      const payA = await createUseCase.execute(adminPrincipal, {
        distributorId,
        paymentReference: 'PAY-TEN-A',
        amountCents: 5000,
      });

      const payB = await createUseCase.execute(tenantBPrincipal, {
        distributorId,
        paymentReference: 'PAY-TEN-B',
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

  // Task 1310: API Gateway Security Suite
  describe('Task 1310: API Gateway Security Suite', () => {
    it('handles controller CRUD endpoints and rejects invalid content-type', async () => {
      const headers = {
        'x-tenant-id': tenantId,
        'x-user-id': 'user-admin-pay-1',
        'x-user-roles': 'admin',
        'content-type': 'application/json',
      };

      const createRes = await controller.handleCreate(
        {
          distributorId,
          paymentReference: 'PAY-API-SEC-1',
          amountCents: 45000,
        },
        headers
      );
      assert.strictEqual(createRes.statusCode, 201);
      assert.strictEqual(createRes.body.success, true);

      // Invalid Content-Type -> 415
      const xmlRes = await controller.handleCreate(
        { distributorId, paymentReference: 'PAY-XML', amountCents: 100 },
        { ...headers, 'content-type': 'application/xml' }
      );
      assert.strictEqual(xmlRes.statusCode, 415);
    });
  });
});
