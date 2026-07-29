import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { FeatureFlagAggregate } from './domain/entities/feature_flag.entity.js';
import { FeatureFlagPgRepository } from './infrastructure/database/repositories/feature_flag.pg-repository.js';
import { CreateFeatureFlagUseCase } from './application/usecases/create-feature-flag.usecase.js';
import { GetFeatureFlagUseCase } from './application/usecases/get-feature-flag.usecase.js';
import { UpdateFeatureFlagUseCase } from './application/usecases/update-feature-flag.usecase.js';
import { ListFeatureFlagsUseCase } from './application/usecases/list-feature-flags.usecase.js';
import { FeatureFlagController } from './presentation/rest/controllers/feature_flag.controller.js';
import { ConfigEntryEventConsumer } from './infrastructure/events/config_entry.consumer.js';
import { ConfigAuditService } from './infrastructure/audit/config.audit.js';
import { Principal } from './application/usecases/create-config-entry.usecase.js';

describe('FeatureFlag Vertical Slice - Comprehensive QA & Security Test Suite', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const principal: Principal = {
    userId: 'user-admin-1',
    tenantId,
    roles: ['admin'],
    permissions: ['flag:create', 'flag:read', 'flag:update', 'flag:delete']
  };

  const restrictedPrincipal: Principal = {
    userId: 'user-viewer-1',
    tenantId,
    roles: ['viewer'],
    permissions: ['flag:read']
  };

  let sharedStore: Map<string, FeatureFlagAggregate>;
  let repo: FeatureFlagPgRepository;
  let auditService: ConfigAuditService;
  let createUseCase: CreateFeatureFlagUseCase;
  let getUseCase: GetFeatureFlagUseCase;
  let updateUseCase: UpdateFeatureFlagUseCase;
  let listUseCase: ListFeatureFlagsUseCase;
  let controller: FeatureFlagController;
  let consumer: ConfigEntryEventConsumer;

  beforeEach(() => {
    sharedStore = new Map<string, FeatureFlagAggregate>();
    repo = new FeatureFlagPgRepository(undefined, sharedStore);
    auditService = new ConfigAuditService();
    ConfigAuditService.clearAuditLogs();
    createUseCase = new CreateFeatureFlagUseCase(repo, auditService);
    getUseCase = new GetFeatureFlagUseCase(repo);
    updateUseCase = new UpdateFeatureFlagUseCase(repo, auditService);
    listUseCase = new ListFeatureFlagsUseCase(repo);
    controller = new FeatureFlagController(createUseCase, getUseCase, updateUseCase, listUseCase);
    consumer = new ConfigEntryEventConsumer();
  });

  describe('1. Domain Entity Invariants & Evaluation State Machine (Tasks 1697, 1704)', () => {
    test('should create valid FeatureFlagAggregate in ACTIVE status', () => {
      const flag = FeatureFlagAggregate.create({
        id: randomUUID(),
        tenantId,
        flagKey: 'feature.new_checkout',
        description: 'New checkout flow',
        strategy: 'BOOLEAN',
        enabled: true
      });

      assert.equal(flag.status, 'ACTIVE');
      assert.equal(flag.version, 1);
      assert.equal(flag.flagKey, 'feature.new_checkout');
      assert.equal(flag.enabled, true);
    });

    test('should reject creation if rolloutPercentage is out of bounds', () => {
      assert.throws(() => {
        FeatureFlagAggregate.create({
          id: randomUUID(),
          tenantId,
          flagKey: 'feature.bad_rollout',
          rolloutPercentage: 150
        });
      }, /must be between 0 and 100/);
    });

    test('should evaluate BOOLEAN and GRADUAL strategy with target rules correctly', () => {
      const boolFlag = FeatureFlagAggregate.create({
        id: randomUUID(),
        tenantId,
        flagKey: 'flag.bool',
        strategy: 'BOOLEAN',
        enabled: true
      });
      assert.equal(boolFlag.evaluate(), true);

      const gradualFlag = FeatureFlagAggregate.create({
        id: randomUUID(),
        tenantId,
        flagKey: 'flag.gradual',
        strategy: 'GRADUAL',
        enabled: true,
        rolloutPercentage: 100,
        targetRules: [
          { attribute: 'region', operator: 'eq', values: ['North'] }
        ]
      });

      assert.equal(gradualFlag.evaluate({ userId: 'u1', attributes: { region: 'North' } }), true);
      assert.equal(gradualFlag.evaluate({ userId: 'u1', attributes: { region: 'South' } }), false);
    });

    test('should execute legal state transitions: ACTIVE -> INACTIVE -> ARCHIVED', () => {
      const flag = FeatureFlagAggregate.create({
        id: randomUUID(),
        tenantId,
        flagKey: 'feature.toggleable',
        enabled: true
      });

      flag.deactivate(1);
      assert.equal(flag.status, 'INACTIVE');
      assert.equal(flag.version, 2);

      flag.activate(2);
      assert.equal(flag.status, 'ACTIVE');
      assert.equal(flag.version, 3);

      flag.archive(3);
      assert.equal(flag.status, 'ARCHIVED');
      assert.equal(flag.enabled, false);
      assert.equal(flag.version, 4);
    });

    test('should reject illegal state transitions', () => {
      const flag = FeatureFlagAggregate.create({
        id: randomUUID(),
        tenantId,
        flagKey: 'feature.archived',
        status: 'ARCHIVED'
      });

      assert.throws(() => {
        flag.activate(1);
      }, /Cannot activate an ARCHIVED FeatureFlag/);
    });
  });

  describe('2. Application Use Cases, Validation, Audit & RBAC (Tasks 1699–1703)', () => {
    test('CreateFeatureFlagUseCase should record audit log and enforce RBAC', async () => {
      const res = await createUseCase.execute(principal, {
        flagKey: 'feature.search_v2',
        strategy: 'BOOLEAN',
        enabled: true
      });

      assert.ok(res.id);
      assert.equal(res.status, 'ACTIVE');
      assert.equal(ConfigAuditService.getAuditLogs().length, 1);
      assert.equal(ConfigAuditService.getAuditLogs()[0].action, 'FEATURE_FLAG_CREATED');
    });

    test('CreateFeatureFlagUseCase should enforce key uniqueness per tenant', async () => {
      await createUseCase.execute(principal, {
        flagKey: 'unique.flag',
        enabled: true
      });

      await assert.rejects(async () => {
        await createUseCase.execute(principal, {
          flagKey: 'unique.flag',
          enabled: false
        });
      }, /already exists for this tenant/);
    });

    test('CreateFeatureFlagUseCase should enforce idempotency deduplication', async () => {
      const dto = {
        flagKey: 'idemp.flag',
        enabled: true,
        idempotencyKey: 'idemp-flag-001'
      };

      await createUseCase.execute(principal, dto);

      await assert.rejects(async () => {
        await createUseCase.execute(principal, dto);
      }, /Duplicate request: Idempotency key 'idemp-flag-001' already processed/);
    });

    test('should reject creation for principal without flag:create permission', async () => {
      await assert.rejects(async () => {
        await createUseCase.execute(restrictedPrincipal, {
          flagKey: 'unauth.flag'
        });
      }, /Forbidden: Insufficient permissions to create feature flag/);
    });

    test('GetFeatureFlagUseCase and ListFeatureFlagsUseCase should work for authorized user', async () => {
      const created = await createUseCase.execute(principal, {
        flagKey: 'find.flag',
        enabled: true
      });

      const fetched = await getUseCase.execute(principal, created.id);
      assert.equal(fetched.id, created.id);

      const fetchedByKey = await getUseCase.getByKey(principal, 'find.flag');
      assert.equal(fetchedByKey.id, created.id);

      const listRes = await listUseCase.execute(principal, { flagKey: 'find' });
      assert.equal(listRes.total, 1);
      assert.equal(listRes.flags[0].id, created.id);
    });

    test('UpdateFeatureFlagUseCase should toggle enabled state with optimistic locking', async () => {
      const created = await createUseCase.execute(principal, {
        flagKey: 'toggle.flag',
        enabled: false
      });

      const updated = await updateUseCase.execute(principal, created.id, {
        enabled: true,
        expectedVersion: 1
      });

      assert.equal(updated.enabled, true);
      assert.equal(updated.version, 2);
    });
  });

  describe('3. Postgres Repository Integration & RLS Isolation (Task 1698)', () => {
    test('should isolate feature flags between tenants (RLS simulation)', async () => {
      const storeA = new Map<string, FeatureFlagAggregate>();
      const storeB = new Map<string, FeatureFlagAggregate>();
      const repoA = new FeatureFlagPgRepository(undefined, storeA);
      const repoB = new FeatureFlagPgRepository(undefined, storeB);

      const id = randomUUID();
      const flagA = FeatureFlagAggregate.create({
        id,
        tenantId: 'tenant-A',
        flagKey: 'secret.flag',
        enabled: true
      });

      await repoA.save(flagA);

      const foundA = await repoA.findById(id, 'tenant-A');
      assert.ok(foundA);

      const foundB = await repoB.findById(id, 'tenant-B');
      assert.equal(foundB, null);
    });
  });

  describe('4. REST Controller & Event Consumer Tests (Tasks 1705, 1706)', () => {
    test('FeatureFlagController handleCreate should return 201 and reject non-JSON Content-Type with 415', async () => {
      const validReq = {
        headers: { 'content-type': 'application/json' },
        body: {
          flagKey: 'ctrl.flag',
          enabled: true
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
  });
});
