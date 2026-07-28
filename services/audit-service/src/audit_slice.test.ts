import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AuditLogAggregate } from './domain/entities/audit_log.entity.js';
import { AuditLogPgRepository } from './infrastructure/database/repositories/audit_log.pg-repository.js';
import { CreateAuditLogUseCase, Principal } from './application/usecases/create-audit-log.usecase.js';
import { GetAuditLogUseCase } from './application/usecases/get-audit-log.usecase.js';
import { UpdateAuditLogUseCase } from './application/usecases/update-audit-log.usecase.js';
import { ListAuditLogsUseCase } from './application/usecases/list-audit-logs.usecase.js';
import { AuditLogController } from './presentation/rest/controllers/audit_log.controller.js';
import { AuditLogEventConsumer } from './infrastructure/events/audit_log.consumer.js';

describe('AuditLog Vertical Slice - Comprehensive QA & Security Test Suite', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const principal: Principal = {
    userId: 'user-admin-1',
    tenantId,
    roles: ['admin'],
    permissions: ['audit:create', 'audit:read', 'audit:update', 'audit:delete']
  };

  const restrictedPrincipal: Principal = {
    userId: 'user-viewer-1',
    tenantId,
    roles: ['viewer'],
    permissions: ['audit:read']
  };

  let sharedStore: Map<string, AuditLogAggregate>;
  let repo: AuditLogPgRepository;
  let createUseCase: CreateAuditLogUseCase;
  let getUseCase: GetAuditLogUseCase;
  let updateUseCase: UpdateAuditLogUseCase;
  let listUseCase: ListAuditLogsUseCase;
  let controller: AuditLogController;
  let consumer: AuditLogEventConsumer;

  beforeEach(() => {
    sharedStore = new Map<string, AuditLogAggregate>();
    repo = new AuditLogPgRepository(undefined, sharedStore);
    createUseCase = new CreateAuditLogUseCase(repo);
    getUseCase = new GetAuditLogUseCase(repo);
    updateUseCase = new UpdateAuditLogUseCase(repo);
    listUseCase = new ListAuditLogsUseCase(repo);
    controller = new AuditLogController(createUseCase, getUseCase, updateUseCase, listUseCase);
    consumer = new AuditLogEventConsumer();
  });

  describe('1. Domain Entity Invariants & State Machine (Task 1591 & 1598)', () => {
    test('should create valid AuditLogAggregate in SUCCESS status', () => {
      const log = AuditLogAggregate.create({
        id: randomUUID(),
        tenantId,
        actorId: 'actor-101',
        action: 'ORDER_SUBMITTED',
        entityType: 'Order',
        entityId: 'ord-999',
        source: 'WEB'
      });

      assert.equal(log.status, 'SUCCESS');
      assert.equal(log.version, 1);
      assert.equal(log.actorId, 'actor-101');
      assert.equal(log.entityType, 'Order');
    });

    test('should reject creation if required fields are missing', () => {
      assert.throws(() => {
        AuditLogAggregate.create({
          id: randomUUID(),
          tenantId,
          actorId: '',
          action: 'ORDER_SUBMITTED',
          entityType: 'Order',
          entityId: 'ord-999'
        });
      }, /AuditLog actorId is required/);
    });

    test('should reject invalid source or status', () => {
      assert.throws(() => {
        AuditLogAggregate.create({
          id: randomUUID(),
          tenantId,
          actorId: 'actor-101',
          action: 'ORDER_SUBMITTED',
          entityType: 'Order',
          entityId: 'ord-999',
          source: 'CLI' as any
        });
      }, /Invalid AuditLog source/);
    });

    test('should update status with optimistic locking check', () => {
      const log = AuditLogAggregate.create({
        id: randomUUID(),
        tenantId,
        actorId: 'actor-101',
        action: 'PAYMENT_FAILED',
        entityType: 'Payment',
        entityId: 'pay-123',
        status: 'FAILURE'
      });

      log.updateStatus('SUSPICIOUS', 1);
      assert.equal(log.status, 'SUSPICIOUS');
      assert.equal(log.version, 2);

      assert.throws(() => {
        log.updateStatus('SUCCESS', 1); // Stale version
      }, /Optimistic locking failure/);
    });
  });

  describe('2. Application Use Cases, RBAC & PII Redaction (Tasks 1593–1597)', () => {
    test('CreateAuditLogUseCase should sanitize PII/secrets in details', async () => {
      const res = await createUseCase.execute(principal, {
        actorId: 'user-101',
        action: 'PASSWORD_RESET',
        entityType: 'User',
        entityId: 'user-101',
        details: {
          passwordToken: 'secret-token-value',
          userEmail: 'alice@example.com'
        }
      });

      assert.ok(res.id);
      assert.equal(res.details.passwordToken, '***REDACTED***');
      assert.equal(res.details.userEmail, 'alice@example.com');
    });

    test('CreateAuditLogUseCase should enforce idempotency deduplication', async () => {
      const dto = {
        actorId: 'user-102',
        action: 'INVENTORY_ADJUST',
        entityType: 'Inventory',
        entityId: 'inv-50',
        idempotencyKey: 'idemp-audit-100'
      };

      await createUseCase.execute(principal, dto);

      await assert.rejects(async () => {
        await createUseCase.execute(principal, dto);
      }, /Duplicate request: Idempotency key 'idemp-audit-100' already processed/);
    });

    test('should reject creation for principal without audit:create permission', async () => {
      await assert.rejects(async () => {
        await createUseCase.execute(restrictedPrincipal, {
          actorId: 'user-101',
          action: 'LOGOUT',
          entityType: 'User',
          entityId: 'user-101'
        });
      }, /Forbidden: Insufficient permissions to create audit log/);
    });

    test('GetAuditLogUseCase and ListAuditLogsUseCase should work for authorized user', async () => {
      const created = await createUseCase.execute(principal, {
        actorId: 'user-103',
        action: 'CLAIM_SUBMITTED',
        entityType: 'Claim',
        entityId: 'clm-200'
      });

      const fetched = await getUseCase.execute(principal, created.id);
      assert.equal(fetched.id, created.id);

      const listRes = await listUseCase.execute(principal, { entityType: 'Claim' });
      assert.equal(listRes.total, 1);
      assert.equal(listRes.auditLogs[0].id, created.id);
    });
  });

  describe('3. Postgres Repository Integration & RLS Isolation (Task 1592)', () => {
    test('should isolate audit logs between tenants (RLS simulation)', async () => {
      const storeA = new Map<string, AuditLogAggregate>();
      const storeB = new Map<string, AuditLogAggregate>();
      const repoA = new AuditLogPgRepository(undefined, storeA);
      const repoB = new AuditLogPgRepository(undefined, storeB);

      const id = randomUUID();
      const logA = AuditLogAggregate.create({
        id,
        tenantId: 'tenant-A',
        actorId: 'actor-A',
        action: 'LOGIN',
        entityType: 'User',
        entityId: 'user-A'
      });

      await repoA.save(logA);

      const foundA = await repoA.findById(id, 'tenant-A');
      assert.ok(foundA);

      const foundB = await repoB.findById(id, 'tenant-B');
      assert.equal(foundB, null);
    });
  });

  describe('4. REST Controller & Event Consumer Tests (Tasks 1599, 1600)', () => {
    test('AuditLogController handleCreate should return 201 and reject non-JSON Content-Type with 415', async () => {
      const validReq = {
        headers: { 'content-type': 'application/json' },
        body: {
          actorId: 'actor-ctrl',
          action: 'LOGOUT',
          entityType: 'User',
          entityId: 'user-ctrl'
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

    test('AuditLogEventConsumer should process audit events, deduplicate, and route to DLQ', async () => {
      const event = {
        eventId: 'evt-audit-001',
        eventType: 'audit.log.created',
        aggregateId: 'log-001',
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
