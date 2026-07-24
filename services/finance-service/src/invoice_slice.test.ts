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
import { randomUUID } from 'node:crypto';

describe('Invoice Full Vertical Slice QA Suite (Tasks 1227-1240)', () => {
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
      'finance:invoice:list',
    ],
  };

  const restrictedPrincipal: any = {
    userId: 'user-guest-1',
    tenantId,
    roles: ['guest'],
    permissions: [],
  };

  const tenantBPrincipal: any = {
    userId: 'user-tenant-b',
    tenantId: tenantBId,
    roles: ['admin'],
    permissions: [
      'finance:invoice:create',
      'finance:invoice:read',
      'finance:invoice:update',
      'finance:invoice:list',
    ],
  };

  beforeEach(() => {
    InvoicePgRepository.clearStore();
    repository = new InvoicePgRepository();
    createUseCase = new CreateInvoiceUseCase(repository);
    getUseCase = new GetInvoiceUseCase(repository);
    updateUseCase = new UpdateInvoiceUseCase(repository);
    listUseCase = new ListInvoicesUseCase(repository);
    eventConsumer = new InvoiceEventConsumer(repository);
    controller = new InvoiceController(repository);
  });

  // Task 1228 & 1235: Domain Entity & State Machine Invariants
  describe('Task 1228 & 1235: Invoice Aggregate & State Machine', () => {
    it('enforces required fields and non-negative monetary amounts', () => {
      assert.throws(
        () => new Invoice({ tenantId: '', distributorId, invoiceNumber: 'INV-1', dueDate: new Date() }),
        /tenantId is required/
      );
      assert.throws(
        () => new Invoice({ tenantId, distributorId: '', invoiceNumber: 'INV-1', dueDate: new Date() }),
        /distributorId is required/
      );
      assert.throws(
        () => new Invoice({ tenantId, distributorId, invoiceNumber: '', dueDate: new Date() }),
        /invoiceNumber is required/
      );

      assert.throws(
        () => new Invoice({ tenantId, distributorId, invoiceNumber: 'INV-NEG', dueDate: new Date(), grossAmountCents: -100 }),
        /Monetary amounts cannot be negative/
      );
    });

    it('calculates totals from invoice items accurately', () => {
      const item1 = new InvoiceItem({
        tenantId,
        productId: randomUUID(),
        description: 'Product A',
        quantity: 2,
        unitPriceCents: 1500, // 2 * 1500 = 3000
      });

      const item2 = new InvoiceItem({
        tenantId,
        productId: randomUUID(),
        description: 'Product B',
        quantity: 1,
        unitPriceCents: 2000, // 1 * 2000 = 2000
      });

      const inv = new Invoice({
        tenantId,
        distributorId,
        invoiceNumber: 'INV-CALC',
        dueDate: new Date(),
        items: [item1, item2],
      });

      assert.strictEqual(inv.grossAmountCents, 5000);
      assert.strictEqual(inv.netAmountCents, 5000);
    });

    it('executes valid state machine transitions and rejects illegal ones', () => {
      const inv = new Invoice({
        tenantId,
        distributorId,
        invoiceNumber: 'INV-STATE',
        dueDate: new Date(),
      });

      assert.strictEqual(inv.status, 'DRAFT');

      // Valid: DRAFT -> ISSUED
      inv.issue();
      assert.strictEqual(inv.status, 'ISSUED');
      assert.strictEqual(inv.domainEvents.length, 1);

      // Valid: ISSUED -> PAID
      inv.pay();
      assert.strictEqual(inv.status, 'PAID');
      assert.ok(inv.paidAt);
      assert.strictEqual(inv.domainEvents.length, 2);

      // Illegal: PAID -> DRAFT
      assert.throws(() => inv.transitionTo('DRAFT'), InvalidInvoiceStateTransitionError);
      // Illegal: PAID -> CANCELLED
      assert.throws(() => inv.transitionTo('CANCELLED'), InvalidInvoiceStateTransitionError);
    });
  });

  // Task 1234: Domain Validation Rules
  describe('Task 1234: Boundary & Domain Validation Rules', () => {
    it('validates Create invoice input and rejects unknown fields', () => {
      assert.throws(
        () => validateCreateInvoiceInput({ distributorId, invoiceNumber: 'INV-1', dueDate: '2026-07-01', unknownField: 'hacked' }),
        /Unknown field 'unknownField' is not allowed/
      );

      assert.throws(
        () => validateCreateInvoiceInput({ invoiceNumber: 'INV-1', dueDate: '2026-07-01' }),
        /REQUIRED_FIELD: distributorId/
      );
    });

    it('validates Update invoice input and version field', () => {
      assert.throws(
        () => validateUpdateInvoiceInput({ status: 'ISSUED' }),
        /REQUIRED_FIELD: version is required/
      );
    });
  });

  // Task 1230 - 1233: Use Cases Suite
  describe('Tasks 1230-1233: Use Cases Execution Suite', () => {
    it('executes CreateInvoiceUseCase with idempotency & uniqueness checks', async () => {
      const created = await createUseCase.execute(
        adminPrincipal,
        {
          distributorId,
          invoiceNumber: 'INV-2026-001',
          grossAmountCents: 10000,
          dueDate: '2026-08-01',
        },
        'idemp-key-inv-1'
      );

      assert.strictEqual(created.invoiceNumber, 'INV-2026-001');
      assert.strictEqual(created.grossAmountCents, 10000);

      // Idempotency check with same key returns same instance
      const duplicateIdemp = await createUseCase.execute(
        adminPrincipal,
        {
          distributorId,
          invoiceNumber: 'INV-2026-001',
          dueDate: '2026-08-01',
        },
        'idemp-key-inv-1'
      );
      assert.strictEqual(duplicateIdemp.id, created.id);

      // Duplicate invoice number with different key throws conflict
      await assert.rejects(
        () =>
          createUseCase.execute(
            adminPrincipal,
            {
              distributorId,
              invoiceNumber: 'INV-2026-001',
              dueDate: '2026-08-01',
            },
            'idemp-key-inv-2'
          ),
        /already exists/
      );
    });

    it('executes Get, Update and List use cases with RBAC and Optimistic Locking', async () => {
      const created = await createUseCase.execute(adminPrincipal, {
        distributorId,
        invoiceNumber: 'INV-2026-002',
        dueDate: '2026-08-01',
      });

      // Get
      const fetched = await getUseCase.execute(adminPrincipal, created.id);
      assert.strictEqual(fetched.id, created.id);

      // Update -> ISSUED (version 1)
      const updated = await updateUseCase.execute(adminPrincipal, created.id, {
        status: 'ISSUED',
        version: 1,
      });
      assert.strictEqual(updated.status, 'ISSUED');

      // Stale Update with version 1 fails
      await assert.rejects(
        () =>
          updateUseCase.execute(adminPrincipal, created.id, {
            status: 'PAID',
            version: 1,
          }),
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
            invoiceNumber: 'INV-UNAUTH',
            dueDate: '2026-08-01',
          }),
        /Forbidden: Insufficient permissions/
      );
    });
  });

  // Task 1229: Repository & Tenant RLS Isolation
  describe('Task 1229: Repository & RLS Tenant Isolation', () => {
    it('enforces tenant RLS isolation between Tenant A and Tenant B', async () => {
      const invA = await createUseCase.execute(adminPrincipal, {
        distributorId,
        invoiceNumber: 'INV-TENANT-A',
        dueDate: '2026-08-01',
      });

      const invB = await createUseCase.execute(tenantBPrincipal, {
        distributorId,
        invoiceNumber: 'INV-TENANT-B',
        dueDate: '2026-08-01',
      });

      // Tenant A cannot read Tenant B invoice
      await assert.rejects(
        () => getUseCase.execute(adminPrincipal, invB.id),
        /Invoice with id .* not found/
      );

      // Tenant B cannot read Tenant A invoice
      await assert.rejects(
        () => getUseCase.execute(tenantBPrincipal, invA.id),
        /Invoice with id .* not found/
      );

      // Tenant A list contains only 1
      const listA = await listUseCase.execute(adminPrincipal, { page: 1, limit: 10 });
      assert.strictEqual(listA.total, 1);
      assert.strictEqual(listA.data[0].invoiceNumber, 'INV-TENANT-A');

      // Tenant B list contains only 1
      const listB = await listUseCase.execute(tenantBPrincipal, { page: 1, limit: 10 });
      assert.strictEqual(listB.total, 1);
      assert.strictEqual(listB.data[0].invoiceNumber, 'INV-TENANT-B');
    });
  });

  // Task 1237: Event Consumer / Projection Handler
  describe('Task 1237: Invoice Event Consumer Idempotency', () => {
    it('processes order.placed.v1 events idempotently', async () => {
      const orderId = randomUUID();
      const event = {
        id: 'evt-order-1',
        tenantId,
        type: 'order.placed.v1',
        payload: {
          orderId,
          distributorId,
          orderNumber: 'ORD-99001',
          totalAmountCents: 12500,
        },
      };

      // First processing creates invoice
      const res1 = await eventConsumer.handleEvent(event);
      assert.strictEqual(res1.success, true);
      assert.strictEqual(res1.status, 'PROCESSED');

      const found = await repository.findByInvoiceNumber('INV-ORD-99001', tenantId);
      assert.ok(found);
      assert.strictEqual(found?.grossAmountCents, 12500);

      // Second processing skips cleanly (deduplicated)
      const res2 = await eventConsumer.handleEvent(event);
      assert.strictEqual(res2.success, true);
      assert.strictEqual(res2.status, 'SKIPPED');
    });
  });

  // Task 1238 & 1239: Controller & Security Suite
  describe('Tasks 1238 & 1239: Controller API Routes & Security Suite', () => {
    it('handles controller CRUD endpoints with correct HTTP status codes', async () => {
      const headers = {
        'x-tenant-id': tenantId,
        'x-user-id': 'user-admin-1',
        'x-user-roles': 'admin',
        'content-type': 'application/json',
      };

      // 1. Create -> 201
      const createRes = await controller.handleCreate(
        {
          distributorId,
          invoiceNumber: 'INV-API-001',
          grossAmountCents: 60000,
          dueDate: '2026-09-01',
        },
        headers
      );
      assert.strictEqual(createRes.statusCode, 201);
      assert.strictEqual(createRes.body.success, true);
      const createdId = (createRes.body as any).invoice.id;

      // 2. Get -> 200
      const getRes = await controller.handleGet(createdId, headers);
      assert.strictEqual(getRes.statusCode, 200);
      assert.strictEqual((getRes.body as any).invoice.invoiceNumber, 'INV-API-001');

      // 3. Update -> 200
      const updateRes = await controller.handleUpdate(
        createdId,
        { status: 'ISSUED', version: 1 },
        headers
      );
      assert.strictEqual(updateRes.statusCode, 200);
      assert.strictEqual((updateRes.body as any).invoice.status, 'ISSUED');

      // 4. List -> 200
      const listRes = await controller.handleList({ page: 1, limit: 10 }, headers);
      assert.strictEqual(listRes.statusCode, 200);
      assert.strictEqual((listRes.body as any).total, 1);

    });

    it('rejects unsupported content-type and security attack vectors', async () => {
      const headersXml = {
        'x-tenant-id': tenantId,
        'content-type': 'application/xml',
      };

      const resXml = await controller.handleCreate(
        { distributorId, invoiceNumber: 'INV-XML', dueDate: '2026-09-01' },
        headersXml
      );
      assert.strictEqual(resXml.statusCode, 415);

      // SQL injection in invoice number handled cleanly
      const headersJson = {
        'x-tenant-id': tenantId,
        'x-user-roles': 'admin',
        'content-type': 'application/json',
      };

      const resSql = await controller.handleCreate(
        { distributorId, invoiceNumber: "INV' OR '1'='1", dueDate: '2026-09-01' },
        headersJson
      );
      assert.strictEqual(resSql.statusCode, 201); // Clean parameterized insert
    });
  });
});
