import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AgeingReport, AgeingReportDomainError, InvalidAgeingReportStateTransitionError } from './domain/entities/ageing-report.entity.js';
import { validateCreateAgeingReportInput, validateUpdateAgeingReportInput } from './domain/validation/ageing-report.validation.js';
import { AgeingReportPgRepository } from './infrastructure/database/repositories/ageing-report.pg-repository.js';
import { CreateAgeingReportUseCase } from './application/usecases/create-ageing-report.usecase.js';
import { GetAgeingReportUseCase } from './application/usecases/get-ageing-report.usecase.js';
import { UpdateAgeingReportUseCase } from './application/usecases/update-ageing-report.usecase.js';
import { ListAgeingReportsUseCase } from './application/usecases/list-ageing-reports.usecase.js';
import { AgeingReportController } from './presentation/rest/controllers/ageing-report.controller.js';
import { AgeingReportAuditService } from './infrastructure/audit/ageing-report.audit.js';

describe('AgeingReport Full Vertical Slice QA & Security Suite (Tasks 1356-1360)', () => {
  const tenantA = '00000000-0000-0000-0000-000000000001';
  const tenantB = '00000000-0000-0000-0000-000000000002';

  const adminPrincipalTenantA = {
    userId: 'user-admin-ageing-1',
    tenantId: tenantA,
    roles: ['admin'],
    permissions: ['finance:*'],
  };

  const adminPrincipalTenantB = {
    userId: 'user-tenant-b-ageing',
    tenantId: tenantB,
    roles: ['admin'],
    permissions: ['finance:*'],
  };

  beforeEach(() => {
    AgeingReportPgRepository.clearInMemoryStore();
    AgeingReportAuditService.clearAuditLogs();
  });

  describe('Task 1357: AgeingReport Domain Entity & Invariants', () => {
    test('enforces invariants: tenantId, distributorId, asOfDate, bucket totals', () => {
      const report = new AgeingReport({
        tenantId: tenantA,
        distributorId: 'dist-101',
        asOfDate: new Date('2026-07-25'),
        currentBucketCents: 10000,
        bucket1To30Cents: 5000,
        bucket31To60Cents: 2000,
        bucket61To90Cents: 1000,
        bucket90PlusCents: 500,
      });

      assert.equal(report.totalOutstandingCents, 18500);
      assert.equal(report.status, 'GENERATED');

      assert.throws(() => {
        new AgeingReport({
          tenantId: tenantA,
          distributorId: 'dist-101',
          asOfDate: new Date('2026-07-25'),
          currentBucketCents: -100,
        });
      }, /currentBucketCents must be >= 0/);

      assert.throws(() => {
        new AgeingReport({
          tenantId: tenantA,
          distributorId: 'dist-101',
          asOfDate: new Date('2026-07-25'),
          currentBucketCents: 100,
          totalOutstandingCents: 9999, // Mismatched total
        });
      }, /totalOutstandingCents \(9999\) must equal sum of buckets \(100\)/);
    });

    test('executes valid state transitions and rejects illegal ones', () => {
      const report = new AgeingReport({
        tenantId: tenantA,
        distributorId: 'dist-101',
        asOfDate: new Date('2026-07-25'),
        currentBucketCents: 5000,
      });

      report.verify();
      assert.equal(report.status, 'VERIFIED');

      report.reconcile();
      assert.equal(report.status, 'RECONCILED');

      report.archive();
      assert.equal(report.status, 'ARCHIVED');

      assert.throws(() => {
        report.verify();
      }, InvalidAgeingReportStateTransitionError);
    });
  });

  describe('AgeingReport Domain Validation Rules', () => {
    test('validates Create input and rejects unknown fields', () => {
      const valid = validateCreateAgeingReportInput({
        distributorId: 'dist-101',
        asOfDate: '2026-07-25',
        currentBucketCents: 5000,
      });
      assert.equal(valid.distributorId, 'dist-101');

      assert.throws(() => {
        validateCreateAgeingReportInput({
          distributorId: 'dist-101',
          asOfDate: '2026-07-25',
          unknownField: 'malicious',
        });
      }, /Unknown field 'unknownField' is not allowed/);
    });

    test('validates Update input and version field', () => {
      const valid = validateUpdateAgeingReportInput({
        status: 'VERIFIED',
        version: 1,
      });
      assert.equal(valid.status, 'VERIFIED');

      assert.throws(() => {
        validateUpdateAgeingReportInput({
          status: 'INVALID_STATUS',
          version: 1,
        });
      }, /status must be one of: GENERATED, VERIFIED, RECONCILED, ARCHIVED/);
    });
  });

  describe('Tasks 1359-1360: AgeingReport Use Cases & Audit Trail', () => {
    test('executes CreateAgeingReportUseCase with idempotency & audit trail', async () => {
      const repository = new AgeingReportPgRepository();
      const createUseCase = new CreateAgeingReportUseCase(repository);

      const dto = {
        distributorId: 'dist-201',
        asOfDate: '2026-07-25',
        currentBucketCents: 12000,
        bucket1To30Cents: 3000,
        idempotencyKey: 'idemp-ageing-201',
      };

      const created = await createUseCase.execute(adminPrincipalTenantA, dto, 'idemp-ageing-201', 'corr-101');
      assert.equal(created.totalOutstandingCents, 15000);

      // Idempotent retry returns identical instance
      const retried = await createUseCase.execute(adminPrincipalTenantA, dto, 'idemp-ageing-201', 'corr-101');
      assert.equal(retried.id, created.id);

      const logs = AgeingReportAuditService.getAuditLogs();
      assert.equal(logs.length, 1);
      assert.equal(logs[0].action, 'AGEING_REPORT_CREATED');
    });

    test('executes Get, Update and List use cases with optimistic locking', async () => {
      const repository = new AgeingReportPgRepository();
      const createUseCase = new CreateAgeingReportUseCase(repository);
      const getUseCase = new GetAgeingReportUseCase(repository);
      const updateUseCase = new UpdateAgeingReportUseCase(repository);
      const listUseCase = new ListAgeingReportsUseCase(repository);

      const created = await createUseCase.execute(adminPrincipalTenantA, {
        distributorId: 'dist-202',
        asOfDate: '2026-07-25',
        currentBucketCents: 8000,
      });

      const fetched = await getUseCase.execute(created.id, adminPrincipalTenantA);
      assert.equal(fetched.distributorId, 'dist-202');

      const updated = await updateUseCase.execute(created.id, adminPrincipalTenantA, {
        status: 'VERIFIED',
        version: 1,
      });
      assert.equal(updated.status, 'VERIFIED');
      assert.equal(updated.version, 2);

      // Optimistic concurrency conflict on stale version 1
      await assert.rejects(async () => {
        await updateUseCase.execute(created.id, adminPrincipalTenantA, {
          status: 'RECONCILED',
          version: 1,
        });
      }, /Optimistic locking conflict/);

      const listResult = await listUseCase.execute(adminPrincipalTenantA);
      assert.equal(listResult.total, 1);
    });

    test('rejects unauthorized principals', async () => {
      const repository = new AgeingReportPgRepository();
      const getUseCase = new GetAgeingReportUseCase(repository);

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

  describe('Task 1358: Repository RLS Isolation Proof', () => {
    test('enforces tenant RLS isolation between Tenant A and Tenant B', async () => {
      const repository = new AgeingReportPgRepository();
      const createUseCase = new CreateAgeingReportUseCase(repository);
      const getUseCase = new GetAgeingReportUseCase(repository);

      const createdA = await createUseCase.execute(adminPrincipalTenantA, {
        distributorId: 'dist-tenant-a',
        asOfDate: '2026-07-25',
        currentBucketCents: 5000,
      });

      const createdB = await createUseCase.execute(adminPrincipalTenantB, {
        distributorId: 'dist-tenant-b',
        asOfDate: '2026-07-25',
        currentBucketCents: 7000,
      });

      // Tenant A cannot read Tenant B record
      await assert.rejects(async () => {
        await getUseCase.execute(createdB.id, adminPrincipalTenantA);
      }, /AgeingReport with id .* not found/);
    });
  });

  describe('AgeingReport Controller REST API & Security', () => {
    test('handles controller CRUD endpoints with correct HTTP status codes', async () => {
      const repository = new AgeingReportPgRepository();
      const createUseCase = new CreateAgeingReportUseCase(repository);
      const getUseCase = new GetAgeingReportUseCase(repository);
      const updateUseCase = new UpdateAgeingReportUseCase(repository);
      const listUseCase = new ListAgeingReportsUseCase(repository);

      const controller = new AgeingReportController(createUseCase, getUseCase, updateUseCase, listUseCase);

      const req = {
        headers: {
          'x-tenant-id': tenantA,
          'x-user-id': 'admin-1',
          'x-user-roles': 'admin',
          'x-user-permissions': 'finance:*',
          'content-type': 'application/json',
        },
        body: {
          distributorId: 'dist-controller',
          asOfDate: '2026-07-25',
          currentBucketCents: 10000,
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
      assert.equal(jsonPayload.data.distributorId, 'dist-controller');
    });

    test('rejects unsupported content-type', async () => {
      const repository = new AgeingReportPgRepository();
      const controller = new AgeingReportController(
        new CreateAgeingReportUseCase(repository),
        new GetAgeingReportUseCase(repository),
        new UpdateAgeingReportUseCase(repository),
        new ListAgeingReportsUseCase(repository)
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
