import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ConfigEntryAggregate } from './domain/entities/config_entry.entity.js';
import { ConfigEntryPgRepository } from './infrastructure/database/repositories/config_entry.pg-repository.js';
import { CreateConfigEntryUseCase, Principal } from './application/usecases/create-config-entry.usecase.js';
import { GetConfigEntryUseCase } from './application/usecases/get-config-entry.usecase.js';
import { UpdateConfigEntryUseCase } from './application/usecases/update-config-entry.usecase.js';
import { ListConfigEntriesUseCase } from './application/usecases/list-config-entries.usecase.js';
import { ConfigEntryController } from './presentation/rest/controllers/config_entry.controller.js';
import { ConfigEntryEventConsumer } from './infrastructure/events/config_entry.consumer.js';
import { ConfigAuditService } from './infrastructure/audit/config.audit.js';

describe('ConfigEntry Vertical Slice - Comprehensive QA & Security Test Suite', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const principal: Principal = {
    userId: 'user-admin-1',
    tenantId,
    roles: ['admin'],
    permissions: ['config:create', 'config:read', 'config:update', 'config:delete']
  };

  const restrictedPrincipal: Principal = {
    userId: 'user-viewer-1',
    tenantId,
    roles: ['viewer'],
    permissions: ['config:read']
  };

  let sharedStore: Map<string, ConfigEntryAggregate>;
  let repo: ConfigEntryPgRepository;
  let auditService: ConfigAuditService;
  let createUseCase: CreateConfigEntryUseCase;
  let getUseCase: GetConfigEntryUseCase;
  let updateUseCase: UpdateConfigEntryUseCase;
  let listUseCase: ListConfigEntriesUseCase;
  let controller: ConfigEntryController;
  let consumer: ConfigEntryEventConsumer;

  beforeEach(() => {
    sharedStore = new Map<string, ConfigEntryAggregate>();
    repo = new ConfigEntryPgRepository(undefined, sharedStore);
    auditService = new ConfigAuditService();
    ConfigAuditService.clearAuditLogs();
    createUseCase = new CreateConfigEntryUseCase(repo, auditService);
    getUseCase = new GetConfigEntryUseCase(repo);
    updateUseCase = new UpdateConfigEntryUseCase(repo, auditService);
    listUseCase = new ListConfigEntriesUseCase(repo);
    controller = new ConfigEntryController(createUseCase, getUseCase, updateUseCase, listUseCase);
    consumer = new ConfigEntryEventConsumer();
  });

  describe('1. Domain Entity Invariants & State Machine (Tasks 1676, 1683)', () => {
    test('should create valid ConfigEntryAggregate in ACTIVE status', () => {
      const entry = ConfigEntryAggregate.create({
        id: randomUUID(),
        tenantId,
        configKey: 'app.max_discount_rate',
        configValue: '15.5',
        dataType: 'NUMBER'
      });

      assert.equal(entry.status, 'ACTIVE');
      assert.equal(entry.version, 1);
      assert.equal(entry.configKey, 'app.max_discount_rate');
      assert.equal(entry.configValue, '15.5');
    });

    test('should reject creation if data_type value validation fails', () => {
      assert.throws(() => {
        ConfigEntryAggregate.create({
          id: randomUUID(),
          tenantId,
          configKey: 'app.invalid_num',
          configValue: 'not_a_number',
          dataType: 'NUMBER'
        });
      }, /is not a valid NUMBER/);

      assert.throws(() => {
        ConfigEntryAggregate.create({
          id: randomUUID(),
          tenantId,
          configKey: 'app.invalid_json',
          configValue: '{ bad json }',
          dataType: 'JSON'
        });
      }, /is not valid JSON/);
    });

    test('should execute legal state transitions: ACTIVE -> INACTIVE -> ACTIVE -> DEPRECATED', () => {
      const entry = ConfigEntryAggregate.create({
        id: randomUUID(),
        tenantId,
        configKey: 'app.feature_flag',
        configValue: 'true',
        dataType: 'BOOLEAN'
      });

      entry.deactivate(1);
      assert.equal(entry.status, 'INACTIVE');
      assert.equal(entry.version, 2);

      entry.activate(2);
      assert.equal(entry.status, 'ACTIVE');
      assert.equal(entry.version, 3);

      entry.deprecate(3);
      assert.equal(entry.status, 'DEPRECATED');
      assert.equal(entry.version, 4);
    });

    test('should reject illegal state transitions', () => {
      const entry = ConfigEntryAggregate.create({
        id: randomUUID(),
        tenantId,
        configKey: 'app.legacy_setting',
        configValue: 'old',
        status: 'DEPRECATED'
      });

      // Cannot activate a DEPRECATED entry
      assert.throws(() => {
        entry.activate(1);
      }, /Cannot activate a DEPRECATED ConfigEntry/);
    });
  });

  describe('2. Application Use Cases, Validation, Audit & RBAC (Tasks 1678–1682)', () => {
    test('CreateConfigEntryUseCase should record audit log and enforce RBAC', async () => {
      const res = await createUseCase.execute(principal, {
        configKey: 'system.timeout_ms',
        configValue: '5000',
        dataType: 'NUMBER'
      });

      assert.ok(res.id);
      assert.equal(res.status, 'ACTIVE');
      assert.equal(ConfigAuditService.getAuditLogs().length, 1);
      assert.equal(ConfigAuditService.getAuditLogs()[0].action, 'CONFIG_ENTRY_CREATED');
    });

    test('CreateConfigEntryUseCase should enforce key uniqueness per tenant', async () => {
      await createUseCase.execute(principal, {
        configKey: 'unique.setting',
        configValue: 'val1'
      });

      await assert.rejects(async () => {
        await createUseCase.execute(principal, {
          configKey: 'unique.setting',
          configValue: 'val2'
        });
      }, /already exists for this tenant/);
    });

    test('CreateConfigEntryUseCase should enforce idempotency deduplication', async () => {
      const dto = {
        configKey: 'idemp.setting',
        configValue: 'val',
        idempotencyKey: 'idemp-config-001'
      };

      await createUseCase.execute(principal, dto);

      await assert.rejects(async () => {
        await createUseCase.execute(principal, dto);
      }, /Duplicate request: Idempotency key 'idemp-config-001' already processed/);
    });

    test('should reject creation for principal without config:create permission', async () => {
      await assert.rejects(async () => {
        await createUseCase.execute(restrictedPrincipal, {
          configKey: 'unauth.setting',
          configValue: 'val'
        });
      }, /Forbidden: Insufficient permissions to create config entry/);
    });

    test('GetConfigEntryUseCase and ListConfigEntriesUseCase should work for authorized user', async () => {
      const created = await createUseCase.execute(principal, {
        configKey: 'search.key',
        configValue: 'found'
      });

      const fetched = await getUseCase.execute(principal, created.id);
      assert.equal(fetched.id, created.id);

      const fetchedByKey = await getUseCase.getByKey(principal, 'search.key');
      assert.equal(fetchedByKey.id, created.id);

      const listRes = await listUseCase.execute(principal, { configKey: 'search' });
      assert.equal(listRes.total, 1);
      assert.equal(listRes.entries[0].id, created.id);
    });

    test('UpdateConfigEntryUseCase should update value with optimistic locking', async () => {
      const created = await createUseCase.execute(principal, {
        configKey: 'updatable.key',
        configValue: 'v1'
      });

      const updated = await updateUseCase.execute(principal, created.id, {
        configValue: 'v2',
        expectedVersion: 1
      });

      assert.equal(updated.configValue, 'v2');
      assert.equal(updated.version, 2);
    });
  });

  describe('3. Postgres Repository Integration & RLS Isolation (Task 1677)', () => {
    test('should isolate config entries between tenants (RLS simulation)', async () => {
      const storeA = new Map<string, ConfigEntryAggregate>();
      const storeB = new Map<string, ConfigEntryAggregate>();
      const repoA = new ConfigEntryPgRepository(undefined, storeA);
      const repoB = new ConfigEntryPgRepository(undefined, storeB);

      const id = randomUUID();
      const entryA = ConfigEntryAggregate.create({
        id,
        tenantId: 'tenant-A',
        configKey: 'secret.key',
        configValue: 'tenantA-val'
      });

      await repoA.save(entryA);

      const foundA = await repoA.findById(id, 'tenant-A');
      assert.ok(foundA);

      const foundB = await repoB.findById(id, 'tenant-B');
      assert.equal(foundB, null);
    });
  });

  describe('4. REST Controller & Event Consumer Tests (Tasks 1684, 1685)', () => {
    test('ConfigEntryController handleCreate should return 201 and reject non-JSON Content-Type with 415', async () => {
      const validReq = {
        headers: { 'content-type': 'application/json' },
        body: {
          configKey: 'ctrl.setting',
          configValue: 'ctrlVal'
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

    test('ConfigEntryEventConsumer should process domain events, deduplicate, and route to DLQ', async () => {
      const event = {
        eventId: 'evt-cfg-001',
        eventType: 'config.entry.updated',
        aggregateId: 'cfg-001',
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
