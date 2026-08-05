import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EWayBill, EWayBillDomainError, InvalidEWayBillStateTransitionError } from './domain/entities/ewaybill.entity.js';
import { validateCreateEWayBillInput, validateUpdateEWayBillInput } from './domain/validation/ewaybill.validation.js';
import { EWayBillPgRepository } from './infrastructure/database/repositories/ewaybill.pg-repository.js';
import { CreateEWayBillUseCase } from './application/usecases/create-ewaybill.usecase.js';
import { GetEWayBillUseCase } from './application/usecases/get-ewaybill.usecase.js';
import { UpdateEWayBillUseCase } from './application/usecases/update-ewaybill.usecase.js';
import { ListEWayBillsUseCase } from './application/usecases/list-ewaybills.usecase.js';
import { EWayBillController } from './presentation/rest/controllers/ewaybill.controller.js';
import { EWayBillAuditService } from './infrastructure/audit/ewaybill.audit.js';

import { EWayBillEventConsumer } from './infrastructure/events/ewaybill.consumer.js';

describe('eWayBill Full Vertical Slice QA & Security Suite (Tasks 1399-1419)', () => {
  const tenantA = '00000000-0000-0000-0000-000000000001';
  const tenantB = '00000000-0000-0000-0000-000000000002';

  const adminPrincipalTenantA = {
    userId: 'user-admin-eway-1',
    tenantId: tenantA,
    roles: ['admin'],
    permissions: ['finance:*'],
  };

  const adminPrincipalTenantB = {
    userId: 'user-tenant-b-eway',
    tenantId: tenantB,
    roles: ['admin'],
    permissions: ['finance:*'],
  };

  beforeEach(() => {
    EWayBillPgRepository.clearInMemoryStore();
    EWayBillAuditService.clearAuditLogs();
  });

  describe('Task 1408: eWayBill Event Consumer & DLQ Handling', () => {
    test('deduplicates events by ID and routes poison messages to DLQ', async () => {
      const consumer = new EWayBillEventConsumer();

      const validEvent = {
        id: 'evt-eway-100',
        name: 'finance.ewaybill.generated',
        tenantId: tenantA,
        occurredAt: new Date().toISOString(),
        payload: { ewayBillNumber: 'EWAY-999' },
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

  describe('Task 1400: eWayBill Domain Entity & Invariants', () => {
    test('enforces constructor invariants: tenantId, invoiceId, ewayBillNumber, distanceKm >= 0', () => {
      const ewaybill = new EWayBill({
        tenantId: tenantA,
        invoiceId: 'inv-uuid-101',
        ewayBillNumber: 'EWAY-2026-990011',
        distanceKm: 150,
      });

      assert.equal(ewaybill.ewayBillNumber, 'EWAY-2026-990011');
      assert.equal(ewaybill.status, 'GENERATED');
      assert.equal(ewaybill.distanceKm, 150);

      assert.throws(() => {
        new EWayBill({
          tenantId: tenantA,
          invoiceId: 'inv-uuid-101',
          ewayBillNumber: '',
        });
      }, /ewayBillNumber is required/);

      assert.throws(() => {
        new EWayBill({
          tenantId: tenantA,
          invoiceId: 'inv-uuid-101',
          ewayBillNumber: 'EWAY-NEG',
          distanceKm: -10,
        });
      }, /distanceKm must be >= 0/);
    });

    test('executes valid state transitions and rejects illegal ones', () => {
      const ewaybill = new EWayBill({
        tenantId: tenantA,
        invoiceId: 'inv-uuid-101',
        ewayBillNumber: 'EWAY-2026-TRANS',
      });

      ewaybill.activate();
      assert.equal(ewaybill.status, 'ACTIVE');

      ewaybill.cancel();
      assert.equal(ewaybill.status, 'CANCELLED');

      assert.throws(() => {
        ewaybill.activate();
      }, InvalidEWayBillStateTransitionError);
    });
  });

  describe('eWayBill Domain Validation Rules', () => {
    test('validates Create input and rejects unknown fields', () => {
      const valid = validateCreateEWayBillInput({
        invoiceId: 'inv-101',
        ewayBillNumber: 'EWAY-VALID-1',
        distanceKm: 45,
      });
      assert.equal(valid.ewayBillNumber, 'EWAY-VALID-1');

      assert.throws(() => {
        validateCreateEWayBillInput({
          invoiceId: 'inv-101',
          ewayBillNumber: 'EWAY-VALID-1',
          maliciousParam: 'attack',
        });
      }, /Unknown field 'maliciousParam' is not allowed/);
    });

    test('validates Update input and version field', () => {
      const valid = validateUpdateEWayBillInput({
        status: 'ACTIVE',
        version: 1,
      });
      assert.equal(valid.status, 'ACTIVE');

      assert.throws(() => {
        validateUpdateEWayBillInput({
          status: 'BAD_STATUS',
          version: 1,
        });
      }, /status must be one of: GENERATED, ACTIVE, CANCELLED, EXPIRED/);
    });
  });

  describe('eWayBill Use Cases & Audit Trail', () => {
    test('executes CreateEWayBillUseCase with idempotency & audit trail', async () => {
      const repository = new EWayBillPgRepository();
      const createUseCase = new CreateEWayBillUseCase(repository);

      const dto = {
        invoiceId: 'inv-201',
        ewayBillNumber: 'EWAY-2026-UC-01',
        distanceKm: 120,
        idempotencyKey: 'idemp-eway-201',
      };

      const created = await createUseCase.execute(adminPrincipalTenantA, dto, 'idemp-eway-201', 'corr-eway-1');
      assert.equal(created.ewayBillNumber, 'EWAY-2026-UC-01');

      // Idempotent retry returns identical instance
      const retried = await createUseCase.execute(adminPrincipalTenantA, dto, 'idemp-eway-201', 'corr-eway-1');
      assert.equal(retried.id, created.id);

      const logs = EWayBillAuditService.getAuditLogs();
      assert.equal(logs.length, 1);
      assert.equal(logs[0].action, 'EWAYBILL_CREATED');
    });

    test('executes Get, Update and List use cases with optimistic locking', async () => {
      const repository = new EWayBillPgRepository();
      const createUseCase = new CreateEWayBillUseCase(repository);
      const getUseCase = new GetEWayBillUseCase(repository);
      const updateUseCase = new UpdateEWayBillUseCase(repository);
      const listUseCase = new ListEWayBillsUseCase(repository);

      const created = await createUseCase.execute(adminPrincipalTenantA, {
        invoiceId: 'inv-202',
        ewayBillNumber: 'EWAY-2026-UC-02',
      });

      const fetched = await getUseCase.execute(created.id, adminPrincipalTenantA);
      assert.equal(fetched.ewayBillNumber, 'EWAY-2026-UC-02');

      const updated = await updateUseCase.execute(created.id, adminPrincipalTenantA, {
        status: 'ACTIVE',
        version: 1,
      });
      assert.equal(updated.status, 'ACTIVE');
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
      const repository = new EWayBillPgRepository();
      const getUseCase = new GetEWayBillUseCase(repository);

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

  describe('Task 1399: Repository RLS Isolation Proof', () => {
    test('enforces tenant RLS isolation between Tenant A and Tenant B', async () => {
      const repository = new EWayBillPgRepository();
      const createUseCase = new CreateEWayBillUseCase(repository);
      const getUseCase = new GetEWayBillUseCase(repository);

      const createdA = await createUseCase.execute(adminPrincipalTenantA, {
        invoiceId: 'inv-tenant-a',
        ewayBillNumber: 'EWAY-TENANT-A',
      });

      const createdB = await createUseCase.execute(adminPrincipalTenantB, {
        invoiceId: 'inv-tenant-b',
        ewayBillNumber: 'EWAY-TENANT-B',
      });

      // Tenant A cannot read Tenant B record
      await assert.rejects(async () => {
        await getUseCase.execute(createdB.id, adminPrincipalTenantA);
      }, /EWayBill with id .* not found/);
    });
  });

  describe('eWayBill Controller REST API & Security', () => {
    test('handles controller CRUD endpoints with correct HTTP status codes', async () => {
      const repository = new EWayBillPgRepository();
      const createUseCase = new CreateEWayBillUseCase(repository);
      const getUseCase = new GetEWayBillUseCase(repository);
      const updateUseCase = new UpdateEWayBillUseCase(repository);
      const listUseCase = new ListEWayBillsUseCase(repository);

      const controller = new EWayBillController(createUseCase, getUseCase, updateUseCase, listUseCase);

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
          ewayBillNumber: 'EWAY-CTRL-100',
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
      assert.equal(jsonPayload.data.ewayBillNumber, 'EWAY-CTRL-100');
    });

    test('rejects unsupported content-type', async () => {
      const repository = new EWayBillPgRepository();
      const controller = new EWayBillController(
        new CreateEWayBillUseCase(repository),
        new GetEWayBillUseCase(repository),
        new UpdateEWayBillUseCase(repository),
        new ListEWayBillsUseCase(repository)
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
