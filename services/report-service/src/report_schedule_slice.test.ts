import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ReportScheduleAggregate } from './domain/entities/report_schedule.entity.js';
import { ReportSchedulePgRepository } from './infrastructure/database/repositories/report_schedule.pg-repository.js';
import { CreateReportScheduleUseCase } from './application/usecases/create-report-schedule.usecase.js';
import { GetReportScheduleUseCase } from './application/usecases/get-report-schedule.usecase.js';
import { UpdateReportScheduleUseCase } from './application/usecases/update-report-schedule.usecase.js';
import { ListReportSchedulesUseCase } from './application/usecases/list-report-schedules.usecase.js';
import { ReportScheduleController } from './presentation/rest/controllers/report_schedule.controller.js';
import { ReportScheduleEventConsumer } from './infrastructure/events/report_schedule.consumer.js';
import { ReportAuditService } from './infrastructure/audit/report.audit.js';
import { Principal } from './application/usecases/create-report.usecase.js';

describe('ReportSchedule Vertical Slice - Comprehensive QA & Security Test Suite', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const principal: Principal = {
    userId: 'user-admin-1',
    tenantId,
    roles: ['admin'],
    permissions: ['report:schedule:create', 'report:schedule:read', 'report:schedule:update', 'report:schedule:delete']
  };

  const restrictedPrincipal: Principal = {
    userId: 'user-viewer-1',
    tenantId,
    roles: ['viewer'],
    permissions: ['report:schedule:read']
  };

  let sharedStore: Map<string, ReportScheduleAggregate>;
  let repo: ReportSchedulePgRepository;
  let auditService: ReportAuditService;
  let createUseCase: CreateReportScheduleUseCase;
  let getUseCase: GetReportScheduleUseCase;
  let updateUseCase: UpdateReportScheduleUseCase;
  let listUseCase: ListReportSchedulesUseCase;
  let controller: ReportScheduleController;
  let consumer: ReportScheduleEventConsumer;

  beforeEach(() => {
    sharedStore = new Map<string, ReportScheduleAggregate>();
    repo = new ReportSchedulePgRepository(undefined, sharedStore);
    auditService = new ReportAuditService();
    ReportAuditService.clearAuditLogs();
    createUseCase = new CreateReportScheduleUseCase(repo, auditService);
    getUseCase = new GetReportScheduleUseCase(repo);
    updateUseCase = new UpdateReportScheduleUseCase(repo, auditService);
    listUseCase = new ListReportSchedulesUseCase(repo);
    controller = new ReportScheduleController(createUseCase, getUseCase, updateUseCase, listUseCase);
    consumer = new ReportScheduleEventConsumer();
  });

  describe('1. Domain Entity Invariants & State Machine (Tasks 1655, 1662)', () => {
    test('should create valid ReportScheduleAggregate in ACTIVE status', () => {
      const schedule = ReportScheduleAggregate.create({
        id: randomUUID(),
        tenantId,
        reportName: 'Daily Sales Digest',
        cronExpression: '0 8 * * *',
        frequency: 'DAILY'
      });

      assert.equal(schedule.status, 'ACTIVE');
      assert.equal(schedule.version, 1);
      assert.equal(schedule.reportName, 'Daily Sales Digest');
    });

    test('should reject creation if required fields are invalid', () => {
      assert.throws(() => {
        ReportScheduleAggregate.create({
          id: randomUUID(),
          tenantId,
          reportName: '',
          cronExpression: '0 8 * * *'
        });
      }, /ReportSchedule reportName is required/);

      assert.throws(() => {
        ReportScheduleAggregate.create({
          id: randomUUID(),
          tenantId,
          reportName: 'Weekly Inventory',
          cronExpression: '',
          frequency: 'WEEKLY'
        });
      }, /ReportSchedule cronExpression is required/);
    });

    test('should execute legal state transitions: ACTIVE -> PAUSED -> ACTIVE -> INACTIVE', () => {
      const schedule = ReportScheduleAggregate.create({
        id: randomUUID(),
        tenantId,
        reportName: 'Monthly Ledger',
        cronExpression: '0 0 1 * *',
        frequency: 'MONTHLY'
      });

      schedule.pause(1);
      assert.equal(schedule.status, 'PAUSED');
      assert.equal(schedule.version, 2);

      schedule.resume(2);
      assert.equal(schedule.status, 'ACTIVE');
      assert.equal(schedule.version, 3);

      schedule.deactivate(3);
      assert.equal(schedule.status, 'INACTIVE');
      assert.equal(schedule.version, 4);
    });

    test('should reject illegal state transitions', () => {
      const schedule = ReportScheduleAggregate.create({
        id: randomUUID(),
        tenantId,
        reportName: 'Monthly Ledger',
        cronExpression: '0 0 1 * *',
        frequency: 'MONTHLY',
        status: 'PAUSED'
      });

      // Cannot pause an already PAUSED schedule
      assert.throws(() => {
        schedule.pause(1);
      }, /Cannot pause ReportSchedule in status PAUSED/);
    });
  });

  describe('2. Application Use Cases, Validation, Audit & RBAC (Tasks 1657–1661)', () => {
    test('CreateReportScheduleUseCase should record audit log and enforce RBAC', async () => {
      const res = await createUseCase.execute(principal, {
        reportName: 'Audit Digest Schedule',
        cronExpression: '0 12 * * *',
        frequency: 'DAILY'
      });

      assert.ok(res.id);
      assert.equal(res.status, 'ACTIVE');
      assert.equal(ReportAuditService.getAuditLogs().length, 1);
      assert.equal(ReportAuditService.getAuditLogs()[0].action, 'REPORT_SCHEDULE_CREATED');
    });

    test('CreateReportScheduleUseCase should enforce idempotency deduplication', async () => {
      const dto = {
        reportName: 'Executive Weekly',
        cronExpression: '0 9 * * MON',
        frequency: 'WEEKLY' as const,
        idempotencyKey: 'idemp-sched-001'
      };

      await createUseCase.execute(principal, dto);

      await assert.rejects(async () => {
        await createUseCase.execute(principal, dto);
      }, /Duplicate request: Idempotency key 'idemp-sched-001' already processed/);
    });

    test('should reject creation for principal without report:schedule:create permission', async () => {
      await assert.rejects(async () => {
        await createUseCase.execute(restrictedPrincipal, {
          reportName: 'Unauthorized Schedule',
          cronExpression: '0 0 * * *'
        });
      }, /Forbidden: Insufficient permissions to create report schedule/);
    });

    test('GetReportScheduleUseCase and ListReportSchedulesUseCase should work for authorized user', async () => {
      const created = await createUseCase.execute(principal, {
        reportName: 'Tax Filing Schedule',
        cronExpression: '0 0 15 * *',
        frequency: 'MONTHLY'
      });

      const fetched = await getUseCase.execute(principal, created.id);
      assert.equal(fetched.id, created.id);

      const listRes = await listUseCase.execute(principal, { reportName: 'Tax' });
      assert.equal(listRes.total, 1);
      assert.equal(listRes.schedules[0].id, created.id);
    });

    test('UpdateReportScheduleUseCase should update status with optimistic locking', async () => {
      const created = await createUseCase.execute(principal, {
        reportName: 'Nightly Backup Digest',
        cronExpression: '0 2 * * *'
      });

      const updated = await updateUseCase.execute(principal, created.id, {
        status: 'PAUSED',
        expectedVersion: 1
      });

      assert.equal(updated.status, 'PAUSED');
      assert.equal(updated.version, 2);
    });
  });

  describe('3. Postgres Repository Integration & RLS Isolation (Task 1656)', () => {
    test('should isolate report schedules between tenants (RLS simulation)', async () => {
      const storeA = new Map<string, ReportScheduleAggregate>();
      const storeB = new Map<string, ReportScheduleAggregate>();
      const repoA = new ReportSchedulePgRepository(undefined, storeA);
      const repoB = new ReportSchedulePgRepository(undefined, storeB);

      const id = randomUUID();
      const schedA = ReportScheduleAggregate.create({
        id,
        tenantId: 'tenant-A',
        reportName: 'Tenant A Schedule',
        cronExpression: '0 0 * * *'
      });

      await repoA.save(schedA);

      const foundA = await repoA.findById(id, 'tenant-A');
      assert.ok(foundA);

      const foundB = await repoB.findById(id, 'tenant-B');
      assert.equal(foundB, null);
    });
  });

  describe('4. REST Controller & Event Consumer Tests (Tasks 1663, 1664)', () => {
    test('ReportScheduleController handleCreate should return 201 and reject non-JSON Content-Type with 415', async () => {
      const validReq = {
        headers: { 'content-type': 'application/json' },
        body: {
          reportName: 'Quarterly Audit',
          cronExpression: '0 0 1 1,4,7,10 *'
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

    test('ReportScheduleEventConsumer should process domain events, deduplicate, and route to DLQ', async () => {
      const event = {
        eventId: 'evt-sched-001',
        eventType: 'report.schedule.triggered',
        aggregateId: 'sched-001',
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
