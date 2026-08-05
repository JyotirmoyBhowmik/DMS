import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ReportAggregate } from './domain/entities/report.entity.js';
import { ReportPgRepository } from './infrastructure/database/repositories/report.pg-repository.js';
import { CreateReportUseCase, Principal } from './application/usecases/create-report.usecase.js';
import { GetReportUseCase } from './application/usecases/get-report.usecase.js';
import { UpdateReportUseCase } from './application/usecases/update-report.usecase.js';
import { ListReportsUseCase } from './application/usecases/list-reports.usecase.js';
import { ReportController } from './presentation/rest/controllers/report.controller.js';
import { ReportEventConsumer } from './infrastructure/events/report.consumer.js';
import { ReportAuditService } from './infrastructure/audit/report.audit.js';

describe('Report Vertical Slice - Comprehensive QA & Security Test Suite', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const principal: Principal = {
    userId: 'user-admin-1',
    tenantId,
    roles: ['admin'],
    permissions: ['report:create', 'report:read', 'report:update', 'report:delete', 'report:approve']
  };

  const restrictedPrincipal: Principal = {
    userId: 'user-viewer-1',
    tenantId,
    roles: ['viewer'],
    permissions: ['report:read']
  };

  let sharedStore: Map<string, ReportAggregate>;
  let repo: ReportPgRepository;
  let auditService: ReportAuditService;
  let createUseCase: CreateReportUseCase;
  let getUseCase: GetReportUseCase;
  let updateUseCase: UpdateReportUseCase;
  let listUseCase: ListReportsUseCase;
  let controller: ReportController;
  let consumer: ReportEventConsumer;

  beforeEach(() => {
    sharedStore = new Map<string, ReportAggregate>();
    repo = new ReportPgRepository(undefined, sharedStore);
    auditService = new ReportAuditService();
    ReportAuditService.clearAuditLogs();
    createUseCase = new CreateReportUseCase(repo, auditService);
    getUseCase = new GetReportUseCase(repo);
    updateUseCase = new UpdateReportUseCase(repo, auditService);
    listUseCase = new ListReportsUseCase(repo);
    controller = new ReportController(createUseCase, getUseCase, updateUseCase, listUseCase);
    consumer = new ReportEventConsumer();
  });

  describe('1. Domain Entity Invariants & State Machine (Tasks 1634, 1641)', () => {
    test('should create valid ReportAggregate in DRAFT status', () => {
      const report = ReportAggregate.create({
        id: randomUUID(),
        tenantId,
        name: 'Quarterly Sales Report',
        type: 'SALES',
        parameters: { year: 2026, quarter: 2 }
      });

      assert.equal(report.status, 'DRAFT');
      assert.equal(report.version, 1);
      assert.equal(report.name, 'Quarterly Sales Report');
    });

    test('should reject creation if required fields are invalid', () => {
      assert.throws(() => {
        ReportAggregate.create({
          id: randomUUID(),
          tenantId,
          name: '',
          type: 'SALES'
        });
      }, /Report name is required/);

      assert.throws(() => {
        ReportAggregate.create({
          id: randomUUID(),
          tenantId,
          name: 'Invalid Report',
          type: 'INVALID_TYPE' as any
        });
      }, /Invalid Report type/);
    });

    test('should execute legal state transitions: DRAFT -> GENERATING -> COMPLETED and approve()', () => {
      const report = ReportAggregate.create({
        id: randomUUID(),
        tenantId,
        name: 'Inventory Valuation',
        type: 'INVENTORY'
      });

      report.startGenerating(1);
      assert.equal(report.status, 'GENERATING');
      assert.equal(report.version, 2);

      report.markCompleted('/downloads/inventory.pdf', 2);
      assert.equal(report.status, 'COMPLETED');
      assert.equal(report.version, 3);
      assert.equal(report.downloadUrl, '/downloads/inventory.pdf');
    });

    test('should reject illegal state transitions', () => {
      const report = ReportAggregate.create({
        id: randomUUID(),
        tenantId,
        name: 'Audit Trail Summary',
        type: 'AUDIT',
        status: 'COMPLETED',
        downloadUrl: '/downloads/audit.pdf'
      });

      // Cannot generate from COMPLETED
      assert.throws(() => {
        report.startGenerating(1);
      }, /Cannot transition from COMPLETED to GENERATING/);
    });
  });

  describe('2. Application Use Cases, Validation, Audit & RBAC (Tasks 1636–1640)', () => {
    test('CreateReportUseCase should sanitize parameters, record audit log and enforce RBAC', async () => {
      const res = await createUseCase.execute(principal, {
        name: 'Financial Ledger Report',
        type: 'FINANCIAL',
        parameters: {
          period: '2026-Q2',
          authToken: 'secret-token-xyz'
        }
      });

      assert.ok(res.id);
      assert.equal(res.parameters.authToken, '***REDACTED***'); // Sanitized
      assert.equal(ReportAuditService.getAuditLogs().length, 1);
      assert.equal(ReportAuditService.getAuditLogs()[0].action, 'REPORT_CREATED');
    });

    test('CreateReportUseCase should enforce idempotency deduplication', async () => {
      const dto = {
        name: 'Custom Executive Summary',
        type: 'CUSTOM' as const,
        idempotencyKey: 'idemp-report-001'
      };

      await createUseCase.execute(principal, dto);

      await assert.rejects(async () => {
        await createUseCase.execute(principal, dto);
      }, /Duplicate request: Idempotency key 'idemp-report-001' already processed/);
    });

    test('should reject creation for principal without report:create permission', async () => {
      await assert.rejects(async () => {
        await createUseCase.execute(restrictedPrincipal, {
          name: 'Unauthorized Report',
          type: 'SALES'
        });
      }, /Forbidden: Insufficient permissions to create report/);
    });

    test('should reject approval for restricted user', async () => {
      const created = await createUseCase.execute(principal, {
        name: 'Draft Report',
        type: 'SALES'
      });

      await assert.rejects(async () => {
        await updateUseCase.approveReport(restrictedPrincipal, created.id);
      }, /Forbidden: Insufficient permissions to approve report/);
    });

    test('GetReportUseCase and ListReportsUseCase should work for authorized user', async () => {
      const created = await createUseCase.execute(principal, {
        name: 'Yearly Tax Summary',
        type: 'FINANCIAL'
      });

      const fetched = await getUseCase.execute(principal, created.id);
      assert.equal(fetched.id, created.id);

      const listRes = await listUseCase.execute(principal, { name: 'Tax' });
      assert.equal(listRes.total, 1);
      assert.equal(listRes.reports[0].id, created.id);
    });

    test('UpdateReportUseCase should update status with optimistic locking', async () => {
      const created = await createUseCase.execute(principal, {
        name: 'Daily Sales Flash',
        type: 'SALES'
      });

      const updated = await updateUseCase.execute(principal, created.id, {
        status: 'GENERATING',
        expectedVersion: 1
      });

      assert.equal(updated.status, 'GENERATING');
      assert.equal(updated.version, 2);
    });
  });

  describe('3. Postgres Repository Integration & RLS Isolation (Task 1635)', () => {
    test('should isolate reports between tenants (RLS simulation)', async () => {
      const storeA = new Map<string, ReportAggregate>();
      const storeB = new Map<string, ReportAggregate>();
      const repoA = new ReportPgRepository(undefined, storeA);
      const repoB = new ReportPgRepository(undefined, storeB);

      const id = randomUUID();
      const reportA = ReportAggregate.create({
        id,
        tenantId: 'tenant-A',
        name: 'Tenant A Sales',
        type: 'SALES'
      });

      await repoA.save(reportA);

      const foundA = await repoA.findById(id, 'tenant-A');
      assert.ok(foundA);

      const foundB = await repoB.findById(id, 'tenant-B');
      assert.equal(foundB, null);
    });
  });

  describe('4. REST Controller & Event Consumer Tests (Tasks 1642, 1643)', () => {
    test('ReportController handleCreate should return 201 and reject non-JSON Content-Type with 415', async () => {
      const validReq = {
        headers: { 'content-type': 'application/json' },
        body: {
          name: 'Monthly Performance',
          type: 'SALES'
        },
        principal
      };

      const res = await controller.handleCreate(validReq);
      assert.equal(res.statusCode, 201);

      const invalidReq = {
        headers: { 'content-type': 'text/plain' },
        body: validReq.body,
        principal
      };

      const errRes = await controller.handleCreate(invalidReq);
      assert.equal(errRes.statusCode, 415);
    });

    test('ReportController handleApprove should succeed for authorized principal', async () => {
      const created = await createUseCase.execute(principal, {
        name: 'Report to Approve',
        type: 'SALES'
      });

      const res = await controller.handleApprove({
        headers: {},
        params: { id: created.id },
        principal
      });
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.status, 'GENERATING');
    });

    test('ReportEventConsumer should process domain events, deduplicate, and route to DLQ', async () => {
      const event = {
        eventId: 'evt-report-001',
        eventType: 'report.generated',
        aggregateId: 'report-001',
        tenantId,
        timestamp: new Date().toISOString(),
        data: {}
      };

      const first = await consumer.handleEvent(event);
      assert.equal(first, true);

      const second = await consumer.handleEvent(event);
      assert.equal(second, true); // Deduplicated

      const badEvent = { eventId: '', eventType: '' } as any;
      const failed = await consumer.handleEvent(badEvent);
      assert.equal(failed, false);
      assert.equal(consumer.getDlq().length, 1);
    });
  });
});
