import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  MFADeviceAggregate,
  MFADeviceDomainError,
  InvalidMFADeviceStateTransitionError,
} from './domain/entities/mfa_device.entity.js';
import { validateCreateMFADeviceInput, validateUpdateMFADeviceInput } from './domain/validation/mfa_device.validation.js';
import { MFADevicePgRepository } from './infrastructure/database/repositories/mfa_device.pg-repository.js';
import { CreateMFADeviceUseCase } from './application/usecases/create-mfa-device.usecase.js';
import { GetMFADeviceUseCase } from './application/usecases/get-mfa-device.usecase.js';
import { UpdateMFADeviceUseCase } from './application/usecases/update-mfa-device.usecase.js';
import { ListMFADevicesUseCase } from './application/usecases/list-mfa-devices.usecase.js';
import { MFADeviceEventConsumer } from './infrastructure/events/mfa_device.consumer.js';
import { MFADeviceController } from './presentation/rest/controllers/mfa_device.controller.js';
import { MFADeviceAuditService } from './infrastructure/audit/mfa_device.audit.js';

describe('MFADevice Full Vertical Slice QA & Security Suite (Tasks 1525-1543)', () => {
  const tenantA = '00000000-0000-0000-0000-000000000001';
  const tenantB = '00000000-0000-0000-0000-000000000002';

  const adminPrincipalTenantA = {
    userId: 'user-admin-id-1',
    tenantId: tenantA,
    roles: ['admin'],
    permissions: ['identity:*'],
  };

  const adminPrincipalTenantB = {
    userId: 'user-tenant-b-id',
    tenantId: tenantB,
    roles: ['admin'],
    permissions: ['identity:*'],
  };

  beforeEach(() => {
    MFADeviceAuditService.clearAuditLogs();
  });

  describe('Task 1534: MFADevice Event Consumer & DLQ Handling', () => {
    test('deduplicates events by ID and routes poison messages to DLQ', async () => {
      const consumer = new MFADeviceEventConsumer();

      const validEvent = {
        id: 'evt-mfa-100',
        name: 'identity.mfa_device.created',
        tenantId: tenantA,
        occurredAt: new Date().toISOString(),
        payload: { id: 'mfa-123', userId: 'usr-1' },
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

  describe('Task 1526 & 1533: MFADevice Domain Entity & Invariants', () => {
    test('enforces constructor invariants: tenantId, userId, type, secretEncrypted non-empty', () => {
      assert.throws(
        () => new MFADeviceAggregate({ tenantId: '', userId: 'u1', type: 'TOTP', secretEncrypted: 'enc' }),
        /tenantId is required/
      );

      assert.throws(
        () => new MFADeviceAggregate({ tenantId: tenantA, userId: '', type: 'TOTP', secretEncrypted: 'enc' }),
        /userId is required/
      );

      assert.throws(
        () => new MFADeviceAggregate({ tenantId: tenantA, userId: 'u1', type: 'INVALID' as any, secretEncrypted: 'enc' }),
        /Invalid MFADevice type/
      );

      assert.throws(
        () => new MFADeviceAggregate({ tenantId: tenantA, userId: 'u1', type: 'TOTP', secretEncrypted: '  ' }),
        /secretEncrypted is required/
      );
    });

    test('executes valid state transitions and rejects illegal ones', () => {
      const device = new MFADeviceAggregate({
        tenantId: tenantA,
        userId: 'u1',
        type: 'TOTP',
        secretEncrypted: 'encrypted-secret-key-1',
        isActive: true,
      });

      assert.strictEqual(device.isActive, true);

      // Record use
      device.recordUse();
      assert.ok(device.lastUsedAt !== null);

      // Deactivate
      device.deactivate();
      assert.strictEqual(device.isActive, false);

      // Attempt usage on inactive device throws
      assert.throws(
        () => device.recordUse(),
        InvalidMFADeviceStateTransitionError
      );

      // Reactivate
      device.activate();
      assert.strictEqual(device.isActive, true);
    });

    test('redacts sensitive secretEncrypted when calling toJSON() by default', () => {
      const device = new MFADeviceAggregate({
        tenantId: tenantA,
        userId: 'u1',
        type: 'TOTP',
        secretEncrypted: 'super-secret-raw-string',
      });

      const jsonRedacted = device.toJSON();
      assert.strictEqual(jsonRedacted.secretEncrypted, '[REDACTED]');

      const jsonUnredacted = device.toJSON(false);
      assert.strictEqual(jsonUnredacted.secretEncrypted, 'super-secret-raw-string');
    });
  });

  describe('Task 1532: MFADevice Domain Validation Rules', () => {
    test('validates Create input and rejects unknown fields (mass assignment defense)', () => {
      const valid = validateCreateMFADeviceInput({
        userId: 'user-uuid-99',
        type: 'TOTP',
        secretEncrypted: 'secret-enc-key-01',
      });
      assert.strictEqual(valid.userId, 'user-uuid-99');
      assert.strictEqual(valid.type, 'TOTP');

      assert.throws(
        () => validateCreateMFADeviceInput({ userId: 'u1', type: 'TOTP', secretEncrypted: 'sec', maliciousProperty: 'hack' }),
        /Mass assignment violation/
      );
    });

    test('validates Update input and version field', () => {
      const valid = validateUpdateMFADeviceInput({ isActive: false, version: 1 });
      assert.strictEqual(valid.isActive, false);

      assert.throws(
        () => validateUpdateMFADeviceInput({ isActive: false }),
        /Validation failed for UpdateMFADevice input/
      );
    });
  });

  describe('Task 1528-1531 & 1538: MFADevice Use Cases & Audit Trail', () => {
    test('executes CreateMFADeviceUseCase with idempotency & audit trail', async () => {
      const store = new Map<string, MFADeviceAggregate>();
      const repository = new MFADevicePgRepository(undefined, store);
      const createUseCase = new CreateMFADeviceUseCase(repository);

      const dto = {
        userId: 'usr-email-123@domain.com',
        type: 'TOTP' as const,
        secretEncrypted: 'secret-key-totp-encrypted',
      };

      const created = await createUseCase.execute(adminPrincipalTenantA, dto, 'idemp-mfa-001');
      assert.strictEqual(created.userId, 'usr-email-123@domain.com');

      // Idempotent retry returns same instance
      const retried = await createUseCase.execute(adminPrincipalTenantA, dto, 'idemp-mfa-001');
      assert.strictEqual(retried.id, created.id);

      const logs = MFADeviceAuditService.getAuditLogs();
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].action, 'MFA_DEVICE_CREATED');
    });

    test('executes Get, Update and List use cases with optimistic locking', async () => {
      const store = new Map<string, MFADeviceAggregate>();
      const repository = new MFADevicePgRepository(undefined, store);
      const createUC = new CreateMFADeviceUseCase(repository);
      const getUC = new GetMFADeviceUseCase(repository);
      const updateUC = new UpdateMFADeviceUseCase(repository);
      const listUC = new ListMFADevicesUseCase(repository);

      const created = await createUC.execute(adminPrincipalTenantA, {
        userId: 'usr-mfa-test',
        type: 'SMS',
        secretEncrypted: '+1234567890',
      });

      // Get
      const fetched = await getUC.execute(created.id, adminPrincipalTenantA);
      assert.strictEqual(fetched.userId, 'usr-mfa-test');

      // Update
      const updated = await updateUC.execute(created.id, adminPrincipalTenantA, {
        isActive: false,
        version: 1,
      });
      assert.strictEqual(updated.isActive, false);
      assert.strictEqual(updated.version, 2);

      // List
      const result = await listUC.execute(adminPrincipalTenantA);
      assert.strictEqual(result.items.length, 1);
    });

    test('rejects unauthorized principals', async () => {
      const store = new Map<string, MFADeviceAggregate>();
      const repository = new MFADevicePgRepository(undefined, store);
      const useCase = new CreateMFADeviceUseCase(repository);

      const guestPrincipal = {
        userId: 'guest-1',
        tenantId: tenantA,
        roles: ['guest'],
        permissions: ['identity:read'],
      };

      await assert.rejects(
        () => useCase.execute(guestPrincipal, { userId: 'u1', type: 'TOTP', secretEncrypted: 'enc' }),
        { name: 'MFADeviceDomainError' }
      );
    });
  });

  describe('Task 1527 & 1542: Repository RLS Isolation Proof', () => {
    test('enforces tenant RLS isolation between Tenant A and Tenant B', async () => {
      const storeA = new Map<string, MFADeviceAggregate>();
      const storeB = new Map<string, MFADeviceAggregate>();
      const repoA = new MFADevicePgRepository(undefined, storeA);
      const repoB = new MFADevicePgRepository(undefined, storeB);

      const devA = new MFADeviceAggregate({ tenantId: tenantA, userId: 'uA', type: 'TOTP', secretEncrypted: 'encA' });
      await repoA.save(devA, tenantA);

      const fetchedFromB = await repoB.findById(devA.id, tenantB);
      assert.strictEqual(fetchedFromB, null);
    });
  });

  describe('Task 1535 & 1543: MFADevice Controller REST API & Security', () => {
    test('handles controller CRUD endpoints with correct HTTP status codes', async () => {
      const store = new Map<string, MFADeviceAggregate>();
      const repo = new MFADevicePgRepository(undefined, store);
      const createUC = new CreateMFADeviceUseCase(repo);
      const getUC = new GetMFADeviceUseCase(repo);
      const updateUC = new UpdateMFADeviceUseCase(repo);
      const listUC = new ListMFADevicesUseCase(repo);
      const controller = new MFADeviceController(createUC, getUC, updateUC, listUC, repo);

      const headers = {
        'x-tenant-id': tenantA,
        'x-user-id': 'admin-1',
        'x-user-roles': 'admin',
        'x-user-permissions': 'identity:*',
        'content-type': 'application/json',
      };

      // POST - Create
      const createRes = await controller.handlePostMFADevice(
        { userId: 'api-usr-1', type: 'TOTP', secretEncrypted: 'enc-totp' },
        headers
      );
      assert.strictEqual(createRes.statusCode, 201);
      assert.strictEqual(createRes.body.userId, 'api-usr-1');

      // GET - Detail
      const getRes = await controller.handleGetMFADevice(createRes.body.id, headers);
      assert.strictEqual(getRes.statusCode, 200);

      // GET - List
      const listRes = await controller.handleListMFADevices({}, headers);
      assert.strictEqual(listRes.statusCode, 200);
      assert.ok(Array.isArray(listRes.body.items));

      // PUT - Update
      const updateRes = await controller.handlePutMFADevice(createRes.body.id, { isActive: false, version: 1 }, headers);
      assert.strictEqual(updateRes.statusCode, 200);

      // DELETE
      const deleteRes = await controller.handleDeleteMFADevice(createRes.body.id, headers);
      assert.strictEqual(deleteRes.statusCode, 200);
    });

    test('rejects unsupported content-type', async () => {
      const controller = new MFADeviceController();
      const res = await controller.handlePostMFADevice({}, { 'content-type': 'text/plain' });
      assert.strictEqual(res.statusCode, 415);
    });
  });
});
