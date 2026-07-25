import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { TaxFiling, TaxFilingDomainError, InvalidTaxFilingStateTransitionError } from './domain/entities/tax-filing.entity.js';
import { validateCreateTaxFilingInput, validateUpdateTaxFilingInput } from './domain/validation/tax-filing.validation.js';
import { TaxFilingPgRepository } from './infrastructure/database/repositories/tax-filing.pg-repository.js';
import { CreateTaxFilingUseCase } from './application/usecases/create-tax-filing.usecase.js';
import { GetTaxFilingUseCase } from './application/usecases/get-tax-filing.usecase.js';
import { UpdateTaxFilingUseCase } from './application/usecases/update-tax-filing.usecase.js';
import { ListTaxFilingsUseCase } from './application/usecases/list-tax-filings.usecase.js';
import { TaxFilingController } from './presentation/rest/controllers/tax-filing.controller.js';
import { TaxFilingAuditService } from './infrastructure/audit/tax-filing.audit.js';

import { TaxFilingEventConsumer } from './infrastructure/events/tax-filing.consumer.js';

describe('TaxFiling Full Vertical Slice QA & Security Suite (Tasks 1421-1440)', () => {
  const tenantA = '00000000-0000-0000-0000-000000000001';
  const tenantB = '00000000-0000-0000-0000-000000000002';

  const adminPrincipalTenantA = {
    userId: 'user-admin-tax-1',
    tenantId: tenantA,
    roles: ['admin'],
    permissions: ['finance:*'],
  };

  const adminPrincipalTenantB = {
    userId: 'user-tenant-b-tax',
    tenantId: tenantB,
    roles: ['admin'],
    permissions: ['finance:*'],
  };

  beforeEach(() => {
    TaxFilingPgRepository.clearInMemoryStore();
    TaxFilingAuditService.clearAuditLogs();
  });

  describe('Task 1429: TaxFiling Event Consumer & DLQ Handling', () => {
    test('deduplicates events by ID and routes poison messages to DLQ', async () => {
      const consumer = new TaxFilingEventConsumer();

      const validEvent = {
        id: 'evt-tax-100',
        name: 'finance.tax_filing.filed',
        tenantId: tenantA,
        occurredAt: new Date().toISOString(),
        payload: { period: '2026-Q2', taxType: 'GST' },
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

  describe('Task 1420: TaxFiling Domain Entity & Invariants', () => {
    test('enforces constructor invariants: tenantId, period, taxType, amounts >= 0', () => {
      const taxFiling = new TaxFiling({
        tenantId: tenantA,
        period: '2026-Q2',
        taxType: 'GST',
        taxableAmountCents: 1000000,
        taxAmountCents: 180000,
      });

      assert.equal(taxFiling.period, '2026-Q2');
      assert.equal(taxFiling.taxType, 'GST');
      assert.equal(taxFiling.status, 'DRAFT');
      assert.equal(taxFiling.taxableAmountCents, 1000000);
      assert.equal(taxFiling.taxAmountCents, 180000);

      assert.throws(() => {
        new TaxFiling({
          tenantId: tenantA,
          period: '',
          taxType: 'GST',
        });
      }, /period is required/);

      assert.throws(() => {
        new TaxFiling({
          tenantId: tenantA,
          period: '2026-Q2',
          taxType: 'GST',
          taxAmountCents: -100,
        });
      }, /taxAmountCents must be >= 0/);
    });

    test('executes valid state transitions and rejects illegal ones', () => {
      const taxFiling = new TaxFiling({
        tenantId: tenantA,
        period: '2026-Q2',
        taxType: 'VAT',
      });

      taxFiling.file('ACK-GST-2026-001');
      assert.equal(taxFiling.status, 'FILED');
      assert.equal(taxFiling.acknowledgementNumber, 'ACK-GST-2026-001');

      taxFiling.accept();
      assert.equal(taxFiling.status, 'ACCEPTED');

      assert.throws(() => {
        taxFiling.file();
      }, InvalidTaxFilingStateTransitionError);
    });
  });

  describe('TaxFiling Domain Validation Rules', () => {
    test('validates Create input and rejects unknown fields', () => {
      const valid = validateCreateTaxFilingInput({
        period: '2026-06',
        taxType: 'GST',
        taxAmountCents: 50000,
      });
      assert.equal(valid.period, '2026-06');

      assert.throws(() => {
        validateCreateTaxFilingInput({
          period: '2026-06',
          taxType: 'GST',
          maliciousParam: 'attack',
        });
      }, /Unknown field 'maliciousParam' is not allowed/);
    });

    test('validates Update input and version field', () => {
      const valid = validateUpdateTaxFilingInput({
        status: 'FILED',
        version: 1,
      });
      assert.equal(valid.status, 'FILED');

      assert.throws(() => {
        validateUpdateTaxFilingInput({
          status: 'BAD_STATUS',
          version: 1,
        });
      }, /status must be one of: DRAFT, FILED, ACCEPTED, REJECTED/);
    });
  });

  describe('TaxFiling Use Cases & Audit Trail', () => {
    test('executes CreateTaxFilingUseCase with idempotency & audit trail', async () => {
      const repository = new TaxFilingPgRepository();
      const createUseCase = new CreateTaxFilingUseCase(repository);

      const dto = {
        period: '2026-Q1',
        taxType: 'GST',
        taxableAmountCents: 500000,
        taxAmountCents: 90000,
        idempotencyKey: 'idemp-tax-201',
      };

      const created = await createUseCase.execute(adminPrincipalTenantA, dto, 'idemp-tax-201', 'corr-tax-1');
      assert.equal(created.period, '2026-Q1');

      // Idempotent retry returns identical instance
      const retried = await createUseCase.execute(adminPrincipalTenantA, dto, 'idemp-tax-201', 'corr-tax-1');
      assert.equal(retried.id, created.id);

      const logs = TaxFilingAuditService.getAuditLogs();
      assert.equal(logs.length, 1);
      assert.equal(logs[0].action, 'TAX_FILING_CREATED');
    });

    test('executes Get, Update and List use cases with optimistic locking', async () => {
      const repository = new TaxFilingPgRepository();
      const createUseCase = new CreateTaxFilingUseCase(repository);
      const getUseCase = new GetTaxFilingUseCase(repository);
      const updateUseCase = new UpdateTaxFilingUseCase(repository);
      const listUseCase = new ListTaxFilingsUseCase(repository);

      const created = await createUseCase.execute(adminPrincipalTenantA, {
        period: '2026-Q3',
        taxType: 'GST',
      });

      const fetched = await getUseCase.execute(created.id, adminPrincipalTenantA);
      assert.equal(fetched.period, '2026-Q3');

      const updated = await updateUseCase.execute(created.id, adminPrincipalTenantA, {
        status: 'FILED',
        version: 1,
      });
      assert.equal(updated.status, 'FILED');
      assert.equal(updated.version, 2);

      // Optimistic concurrency conflict on stale version 1
      await assert.rejects(async () => {
        await updateUseCase.execute(created.id, adminPrincipalTenantA, {
          status: 'ACCEPTED',
          version: 1,
        });
      }, /Optimistic locking conflict/);

      const listResult = await listUseCase.execute(adminPrincipalTenantA);
      assert.equal(listResult.total, 1);
    });

    test('rejects unauthorized principals', async () => {
      const repository = new TaxFilingPgRepository();
      const getUseCase = new GetTaxFilingUseCase(repository);

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

  describe('Repository RLS Isolation Proof', () => {
    test('enforces tenant RLS isolation between Tenant A and Tenant B', async () => {
      const repository = new TaxFilingPgRepository();
      const createUseCase = new CreateTaxFilingUseCase(repository);
      const getUseCase = new GetTaxFilingUseCase(repository);

      const createdA = await createUseCase.execute(adminPrincipalTenantA, {
        period: '2026-06',
        taxType: 'GST',
      });

      const createdB = await createUseCase.execute(adminPrincipalTenantB, {
        period: '2026-06',
        taxType: 'GST',
      });

      // Tenant A cannot read Tenant B record
      await assert.rejects(async () => {
        await getUseCase.execute(createdB.id, adminPrincipalTenantA);
      }, /TaxFiling with id .* not found/);
    });
  });

  describe('TaxFiling Controller REST API & Security', () => {
    test('handles controller CRUD endpoints with correct HTTP status codes', async () => {
      const repository = new TaxFilingPgRepository();
      const createUseCase = new CreateTaxFilingUseCase(repository);
      const getUseCase = new GetTaxFilingUseCase(repository);
      const updateUseCase = new UpdateTaxFilingUseCase(repository);
      const listUseCase = new ListTaxFilingsUseCase(repository);

      const controller = new TaxFilingController(createUseCase, getUseCase, updateUseCase, listUseCase);

      const req = {
        headers: {
          'x-tenant-id': tenantA,
          'x-user-id': 'admin-1',
          'x-user-roles': 'admin',
          'x-user-permissions': 'finance:*',
          'content-type': 'application/json',
        },
        body: {
          period: '2026-07',
          taxType: 'VAT',
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
      assert.equal(jsonPayload.data.period, '2026-07');
    });

    test('rejects unsupported content-type', async () => {
      const repository = new TaxFilingPgRepository();
      const controller = new TaxFilingController(
        new CreateTaxFilingUseCase(repository),
        new GetTaxFilingUseCase(repository),
        new UpdateTaxFilingUseCase(repository),
        new ListTaxFilingsUseCase(repository)
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
