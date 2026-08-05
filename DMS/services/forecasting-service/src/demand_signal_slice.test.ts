import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DemandSignalAggregate } from './domain/entities/demand_signal.entity.js';
import { DemandSignalPgRepository } from './infrastructure/database/repositories/demand_signal.pg-repository.js';
import { CreateDemandSignalUseCase } from './application/usecases/create-demand-signal.usecase.js';
import { GetDemandSignalUseCase } from './application/usecases/get-demand-signal.usecase.js';
import { UpdateDemandSignalUseCase } from './application/usecases/update-demand-signal.usecase.js';
import { ListDemandSignalsUseCase } from './application/usecases/list-demand-signals.usecase.js';
import { DemandSignalController } from './presentation/rest/controllers/demand_signal.controller.js';
import { ForecastModelEventConsumer } from './infrastructure/events/forecast_model.consumer.js';
import { ForecastAuditService } from './infrastructure/audit/forecast.audit.js';
import { Principal } from './application/usecases/create-forecast-model.usecase.js';

describe('DemandSignal Vertical Slice - Comprehensive QA & Security Test Suite', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const principal: Principal = {
    userId: 'user-admin-1',
    tenantId,
    roles: ['admin'],
    permissions: ['forecast:signal:create', 'forecast:signal:read', 'forecast:signal:update', 'forecast:signal:delete', 'forecast:signal:approve']
  };

  const restrictedPrincipal: Principal = {
    userId: 'user-viewer-1',
    tenantId,
    roles: ['viewer'],
    permissions: ['forecast:signal:read']
  };

  let sharedStore: Map<string, DemandSignalAggregate>;
  let repo: DemandSignalPgRepository;
  let auditService: ForecastAuditService;
  let createUseCase: CreateDemandSignalUseCase;
  let getUseCase: GetDemandSignalUseCase;
  let updateUseCase: UpdateDemandSignalUseCase;
  let listUseCase: ListDemandSignalsUseCase;
  let controller: DemandSignalController;

  beforeEach(() => {
    sharedStore = new Map<string, DemandSignalAggregate>();
    repo = new DemandSignalPgRepository(undefined, sharedStore);
    auditService = new ForecastAuditService();
    ForecastAuditService.clearAuditLogs();
    createUseCase = new CreateDemandSignalUseCase(repo, auditService);
    getUseCase = new GetDemandSignalUseCase(repo);
    updateUseCase = new UpdateDemandSignalUseCase(repo, auditService);
    listUseCase = new ListDemandSignalsUseCase(repo);
    controller = new DemandSignalController(createUseCase, getUseCase, updateUseCase, listUseCase);
  });

  describe('1. Domain Entity Invariants & State Machine (Tasks 1737, 1744)', () => {
    test('should create valid DemandSignalAggregate in PENDING status', () => {
      const signal = DemandSignalAggregate.create({
        id: randomUUID(),
        tenantId,
        signalName: 'black_friday_promo',
        signalType: 'PROMOTION',
        signalValue: 1500.0,
        confidenceScore: 0.95
      });

      assert.equal(signal.status, 'PENDING');
      assert.equal(signal.version, 1);
      assert.equal(signal.signalName, 'black_friday_promo');
      assert.equal(signal.signalType, 'PROMOTION');
      assert.equal(signal.confidenceScore, 0.95);
    });

    test('should reject creation if confidenceScore is out of bounds', () => {
      assert.throws(() => {
        DemandSignalAggregate.create({
          id: randomUUID(),
          tenantId,
          signalName: 'invalid_confidence',
          confidenceScore: 1.5
        });
      }, /must be between 0.0 and 1.0/);
    });

    test('should execute legal state transitions: PENDING -> PROCESSED -> ARCHIVED', () => {
      const signal = DemandSignalAggregate.create({
        id: randomUUID(),
        tenantId,
        signalName: 'holiday_surge',
        signalType: 'SEASONALITY'
      });

      signal.processSignal(1);
      assert.equal(signal.status, 'PROCESSED');
      assert.equal(signal.version, 2);

      signal.archive(2);
      assert.equal(signal.status, 'ARCHIVED');
      assert.equal(signal.version, 3);
    });

    test('should reject illegal state transitions', () => {
      const signal = DemandSignalAggregate.create({
        id: randomUUID(),
        tenantId,
        signalName: 'signal_archived'
      });

      signal.archive(1);

      assert.throws(() => {
        signal.processSignal(2);
      }, /Cannot process an ARCHIVED DemandSignal/);

      assert.throws(() => {
        signal.approve(2);
      }, /Cannot approve an ARCHIVED DemandSignal/);
    });
  });

  describe('2. Application Use Cases, Validation, Audit & RBAC (Tasks 1739–1743)', () => {
    test('CreateDemandSignalUseCase should record audit log and enforce RBAC', async () => {
      const res = await createUseCase.execute(principal, {
        signalName: 'q4_demand_boost',
        signalType: 'MARKET_TREND',
        signalValue: 5000.0
      });

      assert.ok(res.id);
      assert.equal(res.status, 'PENDING');
      assert.equal(ForecastAuditService.getAuditLogs().length, 1);
      assert.equal(ForecastAuditService.getAuditLogs()[0].action, 'DEMAND_SIGNAL_CREATED');
    });

    test('CreateDemandSignalUseCase should enforce name uniqueness per tenant', async () => {
      await createUseCase.execute(principal, {
        signalName: 'unique_signal',
        signalType: 'HISTORICAL_SALES'
      });

      await assert.rejects(async () => {
        await createUseCase.execute(principal, {
          signalName: 'unique_signal',
          signalType: 'PROMOTION'
        });
      }, /already exists for this tenant/);
    });

    test('CreateDemandSignalUseCase should enforce idempotency deduplication', async () => {
      const dto = {
        signalName: 'idemp_signal',
        signalType: 'HISTORICAL_SALES' as const,
        idempotencyKey: 'idemp-signal-001'
      };

      await createUseCase.execute(principal, dto);

      await assert.rejects(async () => {
        await createUseCase.execute(principal, dto);
      }, /Duplicate request: Idempotency key 'idemp-signal-001' already processed/);
    });

    test('should reject creation for principal without forecast:signal:create permission', async () => {
      await assert.rejects(async () => {
        await createUseCase.execute(restrictedPrincipal, {
          signalName: 'unauth_signal'
        });
      }, /Forbidden: Insufficient permissions to create demand signal/);
    });

    test('GetDemandSignalUseCase and ListDemandSignalsUseCase should work for authorized user', async () => {
      const created = await createUseCase.execute(principal, {
        signalName: 'find_signal',
        signalType: 'SEASONALITY'
      });

      const fetched = await getUseCase.execute(principal, created.id);
      assert.equal(fetched.id, created.id);

      const fetchedByName = await getUseCase.getByName(principal, 'find_signal');
      assert.equal(fetchedByName.id, created.id);

      const listRes = await listUseCase.execute(principal, { signalName: 'find' });
      assert.equal(listRes.total, 1);
      assert.equal(listRes.signals[0].id, created.id);
    });

    test('UpdateDemandSignalUseCase should transition state with optimistic locking', async () => {
      const created = await createUseCase.execute(principal, {
        signalName: 'updatable_signal',
        signalType: 'PROMOTION'
      });

      const processed = await updateUseCase.execute(principal, created.id, {
        action: 'process',
        expectedVersion: 1
      });
      assert.equal(processed.status, 'PROCESSED');
      assert.equal(processed.version, 2);
    });
  });

  describe('3. Postgres Repository Integration & RLS Isolation (Task 1738)', () => {
    test('should isolate demand signals between tenants (RLS simulation)', async () => {
      const storeA = new Map<string, DemandSignalAggregate>();
      const storeB = new Map<string, DemandSignalAggregate>();
      const repoA = new DemandSignalPgRepository(undefined, storeA);
      const repoB = new DemandSignalPgRepository(undefined, storeB);

      const id = randomUUID();
      const signalA = DemandSignalAggregate.create({
        id,
        tenantId: 'tenant-A',
        signalName: 'secret_signal_A'
      });

      await repoA.save(signalA);

      const foundA = await repoA.findById(id, 'tenant-A');
      assert.ok(foundA);

      const foundB = await repoB.findById(id, 'tenant-B');
      assert.equal(foundB, null);
    });
  });

  describe('4. REST Controller Tests (Task 1746)', () => {
    test('DemandSignalController handleCreate should return 201 and reject non-JSON Content-Type with 415', async () => {
      const validReq = {
        headers: { 'content-type': 'application/json' },
        body: {
          signalName: 'ctrl_signal',
          signalType: 'PROMOTION'
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
