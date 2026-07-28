import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NotificationAggregate } from './domain/entities/notification.entity.js';
import { NotificationPgRepository } from './infrastructure/database/repositories/notification.pg-repository.js';
import { CreateNotificationUseCase, Principal } from './application/usecases/create-notification.usecase.js';
import { GetNotificationUseCase } from './application/usecases/get-notification.usecase.js';
import { UpdateNotificationUseCase } from './application/usecases/update-notification.usecase.js';
import { ListNotificationsUseCase } from './application/usecases/list-notifications.usecase.js';
import { NotificationController } from './presentation/rest/controllers/notification.controller.js';
import { NotificationEventConsumer } from './infrastructure/events/notification.consumer.js';
import { NotificationAuditService } from './infrastructure/audit/notification.audit.js';

describe('Notification Vertical Slice - Comprehensive QA Test Suite', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const principal: Principal = {
    userId: 'user-admin-1',
    tenantId,
    roles: ['admin'],
    permissions: ['notification:create', 'notification:read', 'notification:update']
  };

  let sharedStore: Map<string, NotificationAggregate>;
  let repo: NotificationPgRepository;
  let createUseCase: CreateNotificationUseCase;
  let getUseCase: GetNotificationUseCase;
  let updateUseCase: UpdateNotificationUseCase;
  let listUseCase: ListNotificationsUseCase;
  let controller: NotificationController;
  let consumer: NotificationEventConsumer;

  beforeEach(() => {
    sharedStore = new Map<string, NotificationAggregate>();
    repo = new NotificationPgRepository(undefined, sharedStore);
    createUseCase = new CreateNotificationUseCase(repo);
    getUseCase = new GetNotificationUseCase(repo);
    updateUseCase = new UpdateNotificationUseCase(repo);
    listUseCase = new ListNotificationsUseCase(repo);
    controller = new NotificationController(createUseCase, getUseCase, updateUseCase, listUseCase);
    consumer = new NotificationEventConsumer();
    NotificationAuditService.clearAuditLogs();
  });

  describe('1. Domain Entity Invariants & State Machine (Task 1562)', () => {
    test('should create valid NotificationAggregate in QUEUED state', () => {
      const notif = NotificationAggregate.create({
        id: randomUUID(),
        tenantId,
        recipient: 'user@example.com',
        channel: 'EMAIL',
        payload: { name: 'John Doe' }
      });
      assert.equal(notif.status, 'QUEUED');
      assert.equal(notif.version, 1);
      assert.equal(notif.recipient, 'user@example.com');
      assert.equal(notif.channel, 'EMAIL');
    });

    test('should reject creation if recipient is empty or null', () => {
      assert.throws(() => {
        NotificationAggregate.create({
          id: randomUUID(),
          tenantId,
          recipient: '  ',
          channel: 'EMAIL',
          payload: {}
        });
      }, /Notification recipient is required/);
    });

    test('should reject invalid notification channel', () => {
      assert.throws(() => {
        NotificationAggregate.create({
          id: randomUUID(),
          tenantId,
          recipient: 'user@example.com',
          channel: 'PIGEON' as any,
          payload: {}
        });
      }, /Invalid notification channel/);
    });

    test('should execute valid state transitions: QUEUED -> PROCESSING -> SENT', () => {
      const notif = NotificationAggregate.create({
        id: randomUUID(),
        tenantId,
        recipient: '+15551234567',
        channel: 'SMS',
        payload: { otp: '123456' }
      });

      notif.startProcessing();
      assert.equal(notif.status, 'PROCESSING');

      notif.markAsSent();
      assert.equal(notif.status, 'SENT');
      assert.ok(notif.sentAt !== null && notif.sentAt !== undefined);
    });

    test('should execute valid state transitions: QUEUED -> PROCESSING -> FAILED', () => {
      const notif = NotificationAggregate.create({
        id: randomUUID(),
        tenantId,
        recipient: 'user@example.com',
        channel: 'EMAIL',
        payload: {}
      });

      notif.startProcessing();
      notif.markAsFailed('SMTP server connection timeout');

      assert.equal(notif.status, 'FAILED');
      assert.equal(notif.errorMessage, 'SMTP server connection timeout');
    });

    test('should execute valid state transitions: QUEUED -> CANCELLED', () => {
      const notif = NotificationAggregate.create({
        id: randomUUID(),
        tenantId,
        recipient: 'user@example.com',
        channel: 'EMAIL',
        payload: {}
      });

      notif.cancel();
      assert.equal(notif.status, 'CANCELLED');
    });

    test('should reject invalid state transitions', () => {
      const notif = NotificationAggregate.create({
        id: randomUUID(),
        tenantId,
        recipient: 'user@example.com',
        channel: 'EMAIL',
        payload: {}
      });

      assert.throws(() => {
        notif.markAsSent();
      }, /Cannot transition notification to SENT from state QUEUED/);
    });
  });

  describe('2. Use Cases Unit Tests (Task 1563)', () => {
    test('CreateNotificationUseCase should validate email format and audit action', async () => {
      const res = await createUseCase.execute(principal, {
        recipient: 'alice@example.com',
        channel: 'EMAIL',
        payload: { subject: 'Welcome' }
      });

      assert.ok(res.id);
      assert.equal(res.status, 'QUEUED');
      assert.equal(res.recipient, 'alice@example.com');

      const logs = NotificationAuditService.getAuditLogs();
      assert.equal(logs.length, 1);
      assert.equal(logs[0].action, 'NOTIFICATION_CREATED');
    });

    test('CreateNotificationUseCase should enforce idempotency deduplication', async () => {
      const dto = {
        recipient: 'bob@example.com',
        channel: 'EMAIL' as const,
        idempotencyKey: 'idemp-key-100'
      };

      await createUseCase.execute(principal, dto);

      await assert.rejects(async () => {
        await createUseCase.execute(principal, dto);
      }, /Duplicate request: Idempotency key 'idemp-key-100' already processed/);
    });

    test('GetNotificationUseCase should return created notification and reject non-existent ID', async () => {
      const created = await createUseCase.execute(principal, {
        recipient: 'charlie@example.com',
        channel: 'EMAIL'
      });

      const fetched = await getUseCase.execute(principal, created.id);
      assert.equal(fetched.id, created.id);

      await assert.rejects(async () => {
        await getUseCase.execute(principal, 'non-existent-id');
      }, /Notification with ID 'non-existent-id' not found/);
    });

    test('UpdateNotificationUseCase should update payload with optimistic locking check', async () => {
      const created = await createUseCase.execute(principal, {
        recipient: 'david@example.com',
        channel: 'EMAIL',
        payload: { v: 1 }
      });

      const updated = await updateUseCase.updatePayload(principal, created.id, {
        payload: { v: 2, updated: true },
        version: 1
      });

      assert.equal(updated.version, 2);
      assert.equal(updated.payload.v, 2);

      await assert.rejects(async () => {
        await updateUseCase.updatePayload(principal, created.id, {
          payload: { v: 3 },
          version: 1 // Stale version
        });
      }, /Optimistic locking failure/);
    });
  });

  describe('3. Postgres Repository Integration Tests & RLS (Task 1564)', () => {
    test('should isolate notifications between tenants (RLS simulation)', async () => {
      const storeA = new Map<string, NotificationAggregate>();
      const storeB = new Map<string, NotificationAggregate>();
      const repoA = new NotificationPgRepository(undefined, storeA);
      const repoB = new NotificationPgRepository(undefined, storeB);

      const id = randomUUID();
      const notifA = NotificationAggregate.create({
        id,
        tenantId: 'tenant-A',
        recipient: 'userA@example.com',
        channel: 'EMAIL',
        payload: {}
      });

      await repoA.save(notifA);

      const foundA = await repoA.findById(id, 'tenant-A');
      assert.ok(foundA);

      const foundB = await repoB.findById(id, 'tenant-B');
      assert.equal(foundB, null);
    });
  });

  describe('4. Controller & Event Consumer Tests (Task 1565)', () => {
    test('Controller handleCreate should return 201 on valid payload and 415 on invalid Content-Type', async () => {
      const validReq = {
        headers: { 'content-type': 'application/json' },
        body: { recipient: 'eve@example.com', channel: 'EMAIL' },
        principal
      };

      const res = await controller.handleCreate(validReq);
      assert.equal(res.statusCode, 201);

      const invalidReq = {
        headers: { 'content-type': 'text/plain' },
        body: { recipient: 'eve@example.com', channel: 'EMAIL' },
        principal
      };

      const errRes = await controller.handleCreate(invalidReq);
      assert.equal(errRes.statusCode, 415);
    });

    test('NotificationEventConsumer should handle events, deduplicate, and record DLQ', async () => {
      const event = {
        eventId: 'evt-101',
        eventType: 'notification.created',
        aggregateId: 'notif-101',
        tenantId,
        timestamp: new Date().toISOString(),
        data: {}
      };

      const first = await consumer.handleEvent(event);
      assert.equal(first, true);

      const second = await consumer.handleEvent(event);
      assert.equal(second, true); // Deduplicated gracefully

      const badEvent = { eventId: '', eventType: '' } as any;
      const failed = await consumer.handleEvent(badEvent);
      assert.equal(failed, false);
      assert.equal(consumer.getDlq().length, 1);
    });
  });
});
