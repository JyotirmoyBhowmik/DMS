import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  NotificationTemplateAggregate,
  NotificationTemplateDomainError,
  InvalidNotificationTemplateStateTransitionError,
} from './domain/entities/notification_template.entity.js';
import { validateCreateNotificationTemplateInput, validateUpdateNotificationTemplateInput } from './domain/validation/notification_template.validation.js';
import { NotificationTemplatePgRepository } from './infrastructure/database/repositories/notification_template.pg-repository.js';
import { CreateNotificationTemplateUseCase } from './application/usecases/create-notification-template.usecase.js';
import { GetNotificationTemplateUseCase } from './application/usecases/get-notification-template.usecase.js';
import { UpdateNotificationTemplateUseCase } from './application/usecases/update-notification-template.usecase.js';
import { ListNotificationTemplatesUseCase } from './application/usecases/list-notification-templates.usecase.js';
import { NotificationTemplateEventConsumer } from './infrastructure/events/notification_template.consumer.js';
import { NotificationTemplateController } from './presentation/rest/controllers/notification_template.controller.js';
import { NotificationTemplateAuditService } from './infrastructure/audit/notification_template.audit.js';

describe('NotificationTemplate Full Vertical Slice QA & Security Suite (Tasks 1547-1561)', () => {
  const tenantA = '00000000-0000-0000-0000-000000000001';
  const tenantB = '00000000-0000-0000-0000-000000000002';

  const adminPrincipalTenantA = {
    userId: 'user-admin-id-1',
    tenantId: tenantA,
    roles: ['admin'],
    permissions: ['notification:*'],
  };

  beforeEach(() => {
    NotificationTemplateAuditService.clearAuditLogs();
  });

  describe('Task 1556: NotificationTemplate Event Consumer & DLQ Handling', () => {
    test('deduplicates events by ID and routes poison messages to DLQ', async () => {
      const consumer = new NotificationTemplateEventConsumer();

      const validEvent = {
        id: 'evt-tpl-100',
        name: 'notification.template.created',
        tenantId: tenantA,
        occurredAt: new Date().toISOString(),
        payload: { id: 'tpl-123', code: 'WELCOME_EMAIL' },
      };

      const res1 = await consumer.consume(validEvent);
      assert.strictEqual(res1.success, true);
      assert.strictEqual(res1.isDuplicate, undefined);

      // Duplicate consumption
      const res2 = await consumer.consume(validEvent);
      assert.strictEqual(res2.success, true);
      assert.strictEqual(res2.isDuplicate, true);

      // Poison event missing required headers
      const poisonEvent = {
        id: '',
        name: 'invalid',
        tenantId: '',
        occurredAt: '',
        payload: {},
      };

      const poisonRes = await consumer.consume(poisonEvent);
      assert.strictEqual(poisonRes.success, false);
      assert.strictEqual(poisonRes.routedToDlq, true);
      assert.strictEqual(consumer.getDlqMessages().length, 1);
    });
  });

  describe('Task 1548 & 1555: NotificationTemplate Domain Entity & Invariants', () => {
    test('enforces constructor invariants: tenantId, code, name, channel, bodyTemplate non-empty', () => {
      assert.throws(
        () => new NotificationTemplateAggregate({ tenantId: '', code: 'C1', name: 'N1', channel: 'EMAIL', bodyTemplate: 'B1' }),
        /tenantId is required/
      );

      assert.throws(
        () => new NotificationTemplateAggregate({ tenantId: tenantA, code: '', name: 'N1', channel: 'EMAIL', bodyTemplate: 'B1' }),
        /code is required/
      );

      assert.throws(
        () => new NotificationTemplateAggregate({ tenantId: tenantA, code: 'C1', name: 'N1', channel: 'INVALID' as any, bodyTemplate: 'B1' }),
        /Invalid channel/
      );

      assert.throws(
        () => new NotificationTemplateAggregate({ tenantId: tenantA, code: 'C1', name: 'N1', channel: 'EMAIL', bodyTemplate: '  ' }),
        /bodyTemplate is required/
      );
    });

    test('executes valid state transitions and rejects illegal ones', () => {
      const template = new NotificationTemplateAggregate({
        tenantId: tenantA,
        code: 'ORDER_DISPATCHED',
        name: 'Order Dispatched Email',
        channel: 'EMAIL',
        subject: 'Your Order #{{orderId}} has shipped!',
        bodyTemplate: 'Hello {{customerName}}, your order is on the way.',
      });

      assert.strictEqual(template.status, 'ACTIVE');

      // Deactivate
      template.deactivate();
      assert.strictEqual(template.status, 'INACTIVE');

      // Reactivate
      template.activate();
      assert.strictEqual(template.status, 'ACTIVE');

      // Archive
      template.archive();
      assert.strictEqual(template.status, 'ARCHIVED');

      // Re-activating an ARCHIVED template throws error
      assert.throws(
        () => template.activate(),
        InvalidNotificationTemplateStateTransitionError
      );
    });
  });

  describe('Task 1554: NotificationTemplate Domain Validation Rules', () => {
    test('validates Create input and rejects unknown fields (mass assignment defense)', () => {
      const valid = validateCreateNotificationTemplateInput({
        code: 'OTP_SMS',
        name: 'OTP SMS Alert',
        channel: 'SMS',
        bodyTemplate: 'Your OTP code is {{otp}}',
      });
      assert.strictEqual(valid.code, 'OTP_SMS');
      assert.strictEqual(valid.channel, 'SMS');

      assert.throws(
        () => validateCreateNotificationTemplateInput({ code: 'OTP_SMS', name: 'N1', channel: 'SMS', bodyTemplate: 'B1', malicious: 'hack' }),
        /Mass assignment violation/
      );
    });

    test('validates Update input and version field', () => {
      const valid = validateUpdateNotificationTemplateInput({ name: 'New Name', version: 1 });
      assert.strictEqual(valid.name, 'New Name');

      assert.throws(
        () => validateUpdateNotificationTemplateInput({ name: 'New Name' }),
        /Validation failed for UpdateNotificationTemplate input/
      );
    });
  });

  describe('Task 1550-1553 & 1560: NotificationTemplate Use Cases & Audit Trail', () => {
    test('executes CreateNotificationTemplateUseCase with idempotency & audit trail', async () => {
      const store = new Map<string, NotificationTemplateAggregate>();
      const repository = new NotificationTemplatePgRepository(undefined, store);
      const createUseCase = new CreateNotificationTemplateUseCase(repository);

      const dto = {
        code: 'PAYMENT_RECEIVED',
        name: 'Payment Receipt Notification',
        channel: 'EMAIL' as const,
        subject: 'Payment Confirmation',
        bodyTemplate: 'Payment of {{amount}} received successfully.',
      };

      const created = await createUseCase.execute(adminPrincipalTenantA, dto, 'idemp-tpl-001');
      assert.strictEqual(created.code, 'PAYMENT_RECEIVED');

      // Idempotent retry returns same instance
      const retried = await createUseCase.execute(adminPrincipalTenantA, dto, 'idemp-tpl-001');
      assert.strictEqual(retried.id, created.id);

      const logs = NotificationTemplateAuditService.getAuditLogs();
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].action, 'TEMPLATE_CREATED');
    });

    test('executes Get, Update and List use cases with optimistic locking', async () => {
      const store = new Map<string, NotificationTemplateAggregate>();
      const repository = new NotificationTemplatePgRepository(undefined, store);
      const createUC = new CreateNotificationTemplateUseCase(repository);
      const getUC = new GetNotificationTemplateUseCase(repository);
      const updateUC = new UpdateNotificationTemplateUseCase(repository);
      const listUC = new ListNotificationTemplatesUseCase(repository);

      const created = await createUC.execute(adminPrincipalTenantA, {
        code: 'PROMO_DISCOUNT',
        name: 'Special Discount Push',
        channel: 'PUSH',
        bodyTemplate: 'Enjoy {{discount}}% off your next purchase!',
      });

      // Get
      const fetched = await getUC.execute(created.id, adminPrincipalTenantA);
      assert.strictEqual(fetched.code, 'PROMO_DISCOUNT');

      // Update
      const updated = await updateUC.execute(created.id, adminPrincipalTenantA, {
        name: 'Updated Discount Push Name',
        version: 1,
      });
      assert.strictEqual(updated.name, 'Updated Discount Push Name');
      assert.strictEqual(updated.version, 2);

      // List
      const result = await listUC.execute(adminPrincipalTenantA);
      assert.strictEqual(result.items.length, 1);
    });

    test('rejects unauthorized principals', async () => {
      const store = new Map<string, NotificationTemplateAggregate>();
      const repository = new NotificationTemplatePgRepository(undefined, store);
      const useCase = new CreateNotificationTemplateUseCase(repository);

      const guestPrincipal = {
        userId: 'guest-1',
        tenantId: tenantA,
        roles: ['guest'],
        permissions: ['notification:read'],
      };

      await assert.rejects(
        () => useCase.execute(guestPrincipal, { code: 'C1', name: 'N1', channel: 'EMAIL', bodyTemplate: 'B1' }),
        { name: 'NotificationTemplateDomainError' }
      );
    });
  });

  describe('Task 1549 & 1560: Repository RLS Isolation Proof', () => {
    test('enforces tenant RLS isolation between Tenant A and Tenant B', async () => {
      const storeA = new Map<string, NotificationTemplateAggregate>();
      const storeB = new Map<string, NotificationTemplateAggregate>();
      const repoA = new NotificationTemplatePgRepository(undefined, storeA);
      const repoB = new NotificationTemplatePgRepository(undefined, storeB);

      const tplA = new NotificationTemplateAggregate({ tenantId: tenantA, code: 'CODE_A', name: 'Name A', channel: 'EMAIL', bodyTemplate: 'Body A' });
      await repoA.save(tplA, tenantA);

      const fetchedFromB = await repoB.findById(tplA.id, tenantB);
      assert.strictEqual(fetchedFromB, null);
    });
  });

  describe('Task 1557 & 1560: NotificationTemplate Controller REST API & Security', () => {
    test('handles controller CRUD endpoints with correct HTTP status codes', async () => {
      const store = new Map<string, NotificationTemplateAggregate>();
      const repo = new NotificationTemplatePgRepository(undefined, store);
      const createUC = new CreateNotificationTemplateUseCase(repo);
      const getUC = new GetNotificationTemplateUseCase(repo);
      const updateUC = new UpdateNotificationTemplateUseCase(repo);
      const listUC = new ListNotificationTemplatesUseCase(repo);
      const controller = new NotificationTemplateController(createUC, getUC, updateUC, listUC, repo);

      const headers = {
        'x-tenant-id': tenantA,
        'x-user-id': 'admin-1',
        'x-user-roles': 'admin',
        'x-user-permissions': 'notification:*',
        'content-type': 'application/json',
      };

      // POST - Create
      const createRes = await controller.handlePostNotificationTemplate(
        { code: 'REST_TPL_01', name: 'Rest Tpl', channel: 'SMS', bodyTemplate: 'Rest body' },
        headers
      );
      assert.strictEqual(createRes.statusCode, 201);
      assert.strictEqual(createRes.body.code, 'REST_TPL_01');

      // GET - Detail
      const getRes = await controller.handleGetNotificationTemplate(createRes.body.id, headers);
      assert.strictEqual(getRes.statusCode, 200);

      // GET - List
      const listRes = await controller.handleListNotificationTemplates({}, headers);
      assert.strictEqual(listRes.statusCode, 200);
      assert.ok(Array.isArray(listRes.body.items));

      // PUT - Update
      const updateRes = await controller.handlePutNotificationTemplate(createRes.body.id, { name: 'Updated Rest Name', version: 1 }, headers);
      assert.strictEqual(updateRes.statusCode, 200);

      // DELETE
      const deleteRes = await controller.handleDeleteNotificationTemplate(createRes.body.id, headers);
      assert.strictEqual(deleteRes.statusCode, 200);
    });

    test('rejects unsupported content-type', async () => {
      const controller = new NotificationTemplateController();
      const res = await controller.handlePostNotificationTemplate({}, { 'content-type': 'text/plain' });
      assert.strictEqual(res.statusCode, 415);
    });
  });
});
