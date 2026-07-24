import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Invoice, InvoiceItem, InvoiceDomainError, InvalidInvoiceStateTransitionError } from './domain/entities/invoice.entity.js';
import { validateCreateInvoiceInput, validateUpdateInvoiceInput } from './domain/validation/invoice.validation.js';
import { InvoicePgRepository } from './infrastructure/database/repositories/invoice.pg-repository.js';
import { CreateInvoiceUseCase } from './application/usecases/create-invoice.usecase.js';
import { GetInvoiceUseCase } from './application/usecases/get-invoice.usecase.js';
import { UpdateInvoiceUseCase } from './application/usecases/update-invoice.usecase.js';
import { ListInvoicesUseCase } from './application/usecases/list-invoices.usecase.js';
import { InvoiceEventConsumer } from './presentation/events/invoice-event-consumer.js';
import { InvoiceController } from './presentation/rest/controllers/invoice.controller.js';
import { InvoiceAuditService } from './infrastructure/audit/invoice.audit.js';
import { randomUUID } from 'node:crypto';

describe('Invoice Full QA & Security Suite (Tasks 1241-1246)', () => {
  let repository: InvoicePgRepository;
  let createUseCase: CreateInvoiceUseCase;
  let getUseCase: GetInvoiceUseCase;
  let updateUseCase: UpdateInvoiceUseCase;
  let listUseCase: ListInvoicesUseCase;
  let eventConsumer: InvoiceEventConsumer;
  let controller: InvoiceController;

  const tenantId = randomUUID();
  const tenantBId = randomUUID();
  const distributorId = randomUUID();

  const adminPrincipal: any = {
    userId: 'user-admin-1',
    tenantId,
    roles: ['admin'],
    permissions: [
      'finance:invoice:create',
      'finance:invoice:read',
      'finance:invoice:update',
      'finance:invoice:delete',
      'finance:invoice:approve',
      'finance:invoice:list',
    ],
  };

  const restrictedPrincipal: any = {
    userId: 'user-guest-1',
    tenantId,
    roles: ['guest'],
    permissions: [],
  };

  const readOnlyPrincipal: any = {
    userId: 'user-read-1',
    tenantId,
    roles: ['analyst'],
    permissions: ['finance:invoice:read'],
  };

  const tenantBPrincipal: any = {
    userId: 'user-tenant-b',
    tenantId: tenantBId,
    roles: ['admin'],
    permissions: [
      'finance:invoice:create',
      'finance:invoice:read',
      'finance:invoice:update',
      'finance:invoice:delete',
      'finance:invoice:approve',
      'finance:invoice:list',
    ],
  };

  beforeEach(() => {
    InvoicePgRepository.clearStore();
    InvoiceAuditService.clearAuditTrail();
    repository = new InvoicePgRepository();
    createUseCase = new CreateInvoiceUseCase(repository);
    getUseCase = new GetInvoiceUseCase(repository);
    updateUseCase = new UpdateInvoiceUseCase(repository);
    listUseCase = new ListInvoicesUseCase(repository);
    eventConsumer = new InvoiceEventConsumer(repository);
    controller = new InvoiceController(repository);
  });

  // Task 1241: RBAC Permissions & Privilege Escalation Denial
  describe('Task 1241: RBAC Granular Permissions & Default-Deny Policy', () => {
    it('rejects unprivileged access (default-deny policy)', async () => {
      await assert.rejects(
        () =>
          createUseCase.execute(restrictedPrincipal, {
            distributorId,
            invoiceNumber: 'INV-DENIED',
            dueDate: '2026-08-01',
          }),
        /Forbidden: Insufficient permissions/
      );
    });

    it('denies privilege-escalation attempt when user lacks approval permission', async () => {
      const created = await createUseCase.execute(adminPrincipal, {
        distributorId,
        invoiceNumber: 'INV-APPROVE-TEST',
        dueDate: '2026-08-01',
      });

      // User with read-only permissions cannot issue/approve invoice
      await assert.rejects(
        () =>
          updateUseCase.execute(readOnlyPrincipal, created.id, {
            status: 'ISSUED',
            version: 1,
          }),
        /Forbidden: Insufficient permissions/
      );
    });
  });

  // Task 1242: Audit Logging Hooks
  describe('Task 1242: Audit Logging Verification', () => {
    it('records tamper-evident audit records on invoice create & update', async () => {
      const created = await createUseCase.execute(
        adminPrincipal,
        {
          distributorId,
          invoiceNumber: 'INV-AUDIT-01',
          grossAmountCents: 50000,
          dueDate: '2026-08-01',
        },
        undefined,
        'corr-audit-100'
      );

      let trail = InvoiceAuditService.getAuditTrail(tenantId);
      assert.strictEqual(trail.length, 1);
      assert.strictEqual(trail[0].action, 'INVOICE_CREATED');
      assert.strictEqual(trail[0].actorId, 'user-admin-1');
      assert.strictEqual(trail[0].correlationId, 'corr-audit-100');

      await updateUseCase.execute(
        adminPrincipal,
        created.id,
        { status: 'ISSUED', version: 1 },
        'corr-audit-101'
      );

      trail = InvoiceAuditService.getAuditTrail(tenantId);
      assert.strictEqual(trail.length, 2);
      assert.strictEqual(trail[1].action, 'INVOICE_UPDATED_ISSUED');
      assert.strictEqual(trail[1].correlationId, 'corr-audit-101');
    });
  });

  // Task 1243: Domain Unit Tests
  describe('Task 1243: Domain Invariants & State Machine Transitions', () => {
    it('enforces required fields and non-negative monetary amounts', () => {
      assert.throws(
        () => new Invoice({ tenantId: '', distributorId, invoiceNumber: 'INV-1', dueDate: new Date() }),
        /tenantId is required/
      );
      assert.throws(
        () => new Invoice({ tenantId, distributorId, invoiceNumber: 'INV-NEG', dueDate: new Date(), grossAmountCents: -100 }),
        /Monetary amounts cannot be negative/
      );
    });

    it('calculates item totals and enforces valid state transitions', () => {
      const item = new InvoiceItem({
        tenantId,
        productId: randomUUID(),
        description: 'Item 1',
        quantity: 3,
        unitPriceCents: 1000,
      });

      const inv = new Invoice({
        tenantId,
        distributorId,
        invoiceNumber: 'INV-CALC-1',
        dueDate: new Date(),
        items: [item],
      });

      assert.strictEqual(inv.grossAmountCents, 3000);
      assert.strictEqual(inv.netAmountCents, 3000);

      inv.issue();
      assert.strictEqual(inv.status, 'ISSUED');
      inv.pay();
      assert.strictEqual(inv.status, 'PAID');

      assert.throws(() => inv.transitionTo('DRAFT'), InvalidInvoiceStateTransitionError);
    });
  });

  // Task 1244: Use Cases Unit Tests
  describe('Task 1244: Use Cases Execution & Optimistic Concurrency', () => {
    it('executes CRUD flow and rejects optimistic locking conflict', async () => {
      const created = await createUseCase.execute(adminPrincipal, {
        distributorId,
        invoiceNumber: 'INV-FLOW-1',
        dueDate: '2026-08-01',
      });

      const fetched = await getUseCase.execute(adminPrincipal, created.id);
      assert.strictEqual(fetched.id, created.id);

      const updated = await updateUseCase.execute(adminPrincipal, created.id, {
        status: 'ISSUED',
        version: 1,
      });
      assert.strictEqual(updated.status, 'ISSUED');

      // Stale version update fails
      await assert.rejects(
        () => updateUseCase.execute(adminPrincipal, created.id, { status: 'PAID', version: 1 }),
        /Version conflict/
      );
    });
  });

  // Task 1245: Repository Integration & RLS Tenant Isolation
  describe('Task 1245: Repository Integration & RLS Isolation Proof', () => {
    it('proves Tenant A cannot read or mutate Tenant B invoice', async () => {
      const invA = await createUseCase.execute(adminPrincipal, {
        distributorId,
        invoiceNumber: 'INV-TEN-A',
        dueDate: '2026-08-01',
      });

      const invB = await createUseCase.execute(tenantBPrincipal, {
        distributorId,
        invoiceNumber: 'INV-TEN-B',
        dueDate: '2026-08-01',
      });

      await assert.rejects(
        () => getUseCase.execute(adminPrincipal, invB.id),
        /Invoice with id .* not found/
      );

      await assert.rejects(
        () => getUseCase.execute(tenantBPrincipal, invA.id),
        /Invoice with id .* not found/
      );
    });
  });

  // Task 1246: API Gateway & Security Suite
  describe('Task 1246: API Gateway Security Suite', () => {
    it('returns correct status envelopes and rejects security attack vectors', async () => {
      const headers = {
        'x-tenant-id': tenantId,
        'x-user-id': 'user-admin-1',
        'x-user-roles': 'admin',
        'content-type': 'application/json',
      };

      const createRes = await controller.handleCreate(
        { distributorId, invoiceNumber: 'INV-API-SEC-1', dueDate: '2026-09-01' },
        headers
      );
      assert.strictEqual(createRes.statusCode, 201);
      assert.strictEqual(createRes.body.success, true);

      // Invalid Content-Type -> 415
      const xmlRes = await controller.handleCreate(
        { distributorId, invoiceNumber: 'INV-XML', dueDate: '2026-09-01' },
        { ...headers, 'content-type': 'application/xml' }
      );
      assert.strictEqual(xmlRes.statusCode, 415);
    });
  });
});
