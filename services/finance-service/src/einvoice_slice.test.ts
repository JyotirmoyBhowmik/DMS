import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EInvoice, EInvoiceDomainError, InvalidEInvoiceStateTransitionError } from './domain/entities/einvoice.entity.js';
import { validateCreateEInvoiceInput, validateUpdateEInvoiceInput } from './domain/validation/einvoice.validation.js';
import { EInvoicePgRepository } from './infrastructure/database/repositories/einvoice.pg-repository.js';
import { CreateEInvoiceUseCase } from './application/usecases/create-einvoice.usecase.js';
import { GetEInvoiceUseCase } from './application/usecases/get-einvoice.usecase.js';
import { UpdateEInvoiceUseCase } from './application/usecases/update-einvoice.usecase.js';
import { ListEInvoicesUseCase } from './application/usecases/list-einvoices.usecase.js';
import { EInvoiceController } from './presentation/rest/controllers/einvoice.controller.js';
import { EInvoiceAuditService } from './infrastructure/audit/einvoice.audit.js';

import { EInvoiceEventConsumer } from './infrastructure/events/einvoice.consumer.js';

describe('eInvoice Full Vertical Slice QA & Security Suite (Tasks 1377-1387)', () => {
  const tenantA = '00000000-0000-0000-0000-000000000001';
  const tenantB = '00000000-0000-0000-0000-000000000002';

  const adminPrincipalTenantA = {
    userId: 'user-admin-einv-1',
    tenantId: tenantA,
    roles: ['admin'],
    permissions: ['finance:*'],
  };

  const adminPrincipalTenantB = {
    userId: 'user-tenant-b-einv',
    tenantId: tenantB,
    roles: ['admin'],
    permissions: ['finance:*'],
  };

  beforeEach(() => {
    EInvoicePgRepository.clearInMemoryStore();
    EInvoiceAuditService.clearAuditLogs();
  });

  describe('Task 1387: eInvoice Event Consumer & DLQ Handling', () => {
    test('deduplicates events by ID and routes poison messages to DLQ', async () => {
      const consumer = new EInvoiceEventConsumer();

      const validEvent = {
        id: 'evt-einv-100',
        name: 'finance.einvoice.generated',
        tenantId: tenantA,
        occurredAt: new Date().toISOString(),
        payload: { irn: 'IRN-999' },
      };

      const res1 = await consumer.consume(validEvent);
      assert.equal(res1.success, true);

      // Duplicate event
      const res2 = await consumer.consume(validEvent);
      assert.equal(res2.success, true);
      assert.equal(res2.reason, 'DUPLICATE_SKIPPED');

      // Poison event
      const resPoison = await consumer.consume({ id: '', name: 'invalid', tenantId: '', occurredAt: '' } as any);
      assert.equal(resPoison.success, false);
      assert.equal(resPoison.reason, 'POISON_EVENT');
      assert.equal(consumer.getDlqMessages().length, 1);
    });
  });

  describe('Task 1378: eInvoice Domain Entity & Invariants', () => {
    test('enforces constructor invariants: tenantId, invoiceId, irn, amounts >= 0', () => {
      const einvoice = new EInvoice({
        tenantId: tenantA,
        invoiceId: 'inv-uuid-101',
        irn: 'IRN-2026-990011',
        taxAmountCents: 1800,
        totalAmountCents: 11800,
      });

      assert.equal(einvoice.irn, 'IRN-2026-990011');
      assert.equal(einvoice.status, 'PENDING');
      assert.equal(einvoice.taxAmountCents, 1800);
      assert.equal(einvoice.totalAmountCents, 11800);

      assert.throws(() => {
        new EInvoice({
          tenantId: tenantA,
          invoiceId: 'inv-uuid-101',
          irn: '',
        });
      }, /irn is required/);

      assert.throws(() => {
        new EInvoice({
          tenantId: tenantA,
          invoiceId: 'inv-uuid-101',
          irn: 'IRN-2026-NEG',
          taxAmountCents: -50,
        });
      }, /taxAmountCents must be >= 0/);
    });

    test('executes valid state transitions and rejects illegal ones', () => {
      const einvoice = new EInvoice({
        tenantId: tenantA,
        invoiceId: 'inv-uuid-101',
        irn: 'IRN-2026-TRANS',
      });

      einvoice.markGenerated();
      assert.equal(einvoice.status, 'GENERATED');

      einvoice.markCancelled();
      assert.equal(einvoice.status, 'CANCELLED');

      assert.throws(() => {
        einvoice.markGenerated();
      }, InvalidEInvoiceStateTransitionError);
    });
  });

  describe('eInvoice Domain Validation Rules', () => {
    test('validates Create input and rejects unknown fields', () => {
      const valid = validateCreateEInvoiceInput({
        invoiceId: 'inv-101',
        irn: 'IRN-VALID-1',
        taxAmountCents: 500,
      });
      assert.equal(valid.irn, 'IRN-VALID-1');

      assert.throws(() => {
        validateCreateEInvoiceInput({
          invoiceId: 'inv-101',
          irn: 'IRN-VALID-1',
          maliciousParam: 'attack',
        });
      }, /Unknown field 'maliciousParam' is not allowed/);
    });

    test('validates Update input and version field', () => {
      const valid = validateUpdateEInvoiceInput({
        status: 'GENERATED',
        version: 1,
      });
      assert.equal(valid.status, 'GENERATED');

      assert.throws(() => {
        validateUpdateEInvoiceInput({
          status: 'BAD_STATUS',
          version: 1,
        });
      }, /status must be one of: PENDING, GENERATED, CANCELLED, FAILED/);
    });
  });

  describe('Task 1380: eInvoice Use Cases & Audit Trail', () => {
    test('executes CreateEInvoiceUseCase with idempotency & audit trail', async () => {
      const repository = new EInvoicePgRepository();
      const createUseCase = new CreateEInvoiceUseCase(repository);

      const dto = {
        invoiceId: 'inv-201',
        irn: 'IRN-2026-UC-01',
        taxAmountCents: 2000,
        totalAmountCents: 12000,
        idempotencyKey: 'idemp-einv-201',
      };

      const created = await createUseCase.execute(adminPrincipalTenantA, dto, 'idemp-einv-201', 'corr-einv-1');
      assert.equal(created.irn, 'IRN-2026-UC-01');

      // Idempotent retry returns identical instance
      const retried = await createUseCase.execute(adminPrincipalTenantA, dto, 'idemp-einv-201', 'corr-einv-1');
      assert.equal(retried.id, created.id);

      const logs = EInvoiceAuditService.getAuditLogs();
      assert.equal(logs.length, 1);
      assert.equal(logs[0].action, 'EINVOICE_CREATED');
    });

    test('executes Get, Update and List use cases with optimistic locking', async () => {
      const repository = new EInvoicePgRepository();
      const createUseCase = new CreateEInvoiceUseCase(repository);
      const getUseCase = new GetEInvoiceUseCase(repository);
      const updateUseCase = new UpdateEInvoiceUseCase(repository);
      const listUseCase = new ListEInvoicesUseCase(repository);

      const created = await createUseCase.execute(adminPrincipalTenantA, {
        invoiceId: 'inv-202',
        irn: 'IRN-2026-UC-02',
      });

      const fetched = await getUseCase.execute(created.id, adminPrincipalTenantA);
      assert.equal(fetched.irn, 'IRN-2026-UC-02');

      const updated = await updateUseCase.execute(created.id, adminPrincipalTenantA, {
        status: 'GENERATED',
        version: 1,
      });
      assert.equal(updated.status, 'GENERATED');
      assert.equal(updated.version, 2);

      // Optimistic concurrency conflict on stale version 1
      await assert.rejects(async () => {
        await updateUseCase.execute(created.id, adminPrincipalTenantA, {
          status: 'CANCELLED',
          version: 1,
        });
      }, /Optimistic locking conflict/);

      const listResult = await listUseCase.execute(adminPrincipalTenantA);
      assert.equal(listResult.total, 1);
    });

    test('rejects unauthorized principals', async () => {
      const repository = new EInvoicePgRepository();
      const getUseCase = new GetEInvoiceUseCase(repository);

      const unprivileged = {
        userId: 'user-guest',
        tenantId: tenantA,
        roles: ['guest'],
        permissions: [],
      };

      await assert.rejects(async () => {
        await getUseCase.execute('some-id', unprivileged);
      }, /Forbidden: Insufficient permissions/);
    });
  });

  describe('Task 1379: Repository RLS Isolation Proof', () => {
    test('enforces tenant RLS isolation between Tenant A and Tenant B', async () => {
      const repository = new EInvoicePgRepository();
      const createUseCase = new CreateEInvoiceUseCase(repository);
      const getUseCase = new GetEInvoiceUseCase(repository);

      const createdA = await createUseCase.execute(adminPrincipalTenantA, {
        invoiceId: 'inv-tenant-a',
        irn: 'IRN-TENANT-A',
      });

      const createdB = await createUseCase.execute(adminPrincipalTenantB, {
        invoiceId: 'inv-tenant-b',
        irn: 'IRN-TENANT-B',
      });

      // Tenant A cannot read Tenant B record
      await assert.rejects(async () => {
        await getUseCase.execute(createdB.id, adminPrincipalTenantA);
      }, /EInvoice with id .* not found/);
    });
  });

  describe('eInvoice Controller REST API & Security', () => {
    test('handles controller CRUD endpoints with correct HTTP status codes', async () => {
      const repository = new EInvoicePgRepository();
      const createUseCase = new CreateEInvoiceUseCase(repository);
      const getUseCase = new GetEInvoiceUseCase(repository);
      const updateUseCase = new UpdateEInvoiceUseCase(repository);
      const listUseCase = new ListEInvoicesUseCase(repository);

      const controller = new EInvoiceController(createUseCase, getUseCase, updateUseCase, listUseCase);

      const req = {
        headers: {
          'x-tenant-id': tenantA,
          'x-user-id': 'admin-1',
          'x-user-roles': 'admin',
          'x-user-permissions': 'finance:*',
          'content-type': 'application/json',
        },
        body: {
          invoiceId: 'inv-ctrl-1',
          irn: 'IRN-CTRL-100',
        },
        query: {},
        params: {},
      };

      let statusCode = 0;
      let jsonPayload: any = null;
      const res = {
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        json: (data: any) => {
          jsonPayload = data;
        },
      };

      await controller.create(req, res);
      assert.equal(statusCode, 201);
      assert.equal(jsonPayload.success, true);
      assert.equal(jsonPayload.data.irn, 'IRN-CTRL-100');
    });

    test('rejects unsupported content-type', async () => {
      const repository = new EInvoicePgRepository();
      const controller = new EInvoiceController(
        new CreateEInvoiceUseCase(repository),
        new GetEInvoiceUseCase(repository),
        new UpdateEInvoiceUseCase(repository),
        new ListEInvoicesUseCase(repository)
      );

      const req = {
        headers: {
          'content-type': 'text/plain',
        },
        body: 'invalid',
      };

      let statusCode = 0;
      let jsonPayload: any = null;
      const res = {
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        json: (data: any) => {
          jsonPayload = data;
        },
      };

      await controller.create(req, res);
      assert.equal(statusCode, 415);
      assert.equal(jsonPayload.success, false);
      assert.equal(jsonPayload.error.message, 'Unsupported Media Type: Content-Type must be application/json');
    });
  });
});
