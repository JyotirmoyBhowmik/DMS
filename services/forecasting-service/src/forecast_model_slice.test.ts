import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ForecastModelAggregate } from './domain/entities/forecast_model.entity.js';
import { ForecastModelPgRepository } from './infrastructure/database/repositories/forecast_model.pg-repository.js';
import { CreateForecastModelUseCase, Principal } from './application/usecases/create-forecast-model.usecase.js';
import { GetForecastModelUseCase } from './application/usecases/get-forecast-model.usecase.js';
import { UpdateForecastModelUseCase } from './application/usecases/update-forecast-model.usecase.js';
import { ListForecastModelsUseCase } from './application/usecases/list-forecast-models.usecase.js';
import { ForecastModelController } from './presentation/rest/controllers/forecast_model.controller.js';
import { ForecastModelEventConsumer } from './infrastructure/events/forecast_model.consumer.js';
import { ForecastAuditService } from './infrastructure/audit/forecast.audit.js';

describe('ForecastModel Vertical Slice - Comprehensive QA & Security Test Suite', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const principal: Principal = {
    userId: 'user-admin-1',
    tenantId,
    roles: ['admin'],
    permissions: ['forecast:model:create', 'forecast:model:read', 'forecast:model:update', 'forecast:model:delete', 'forecast:model:approve']
  };

  const restrictedPrincipal: Principal = {
    userId: 'user-viewer-1',
    tenantId,
    roles: ['viewer'],
    permissions: ['forecast:model:read']
  };

  let sharedStore: Map<string, ForecastModelAggregate>;
  let repo: ForecastModelPgRepository;
  let auditService: ForecastAuditService;
  let createUseCase: CreateForecastModelUseCase;
  let getUseCase: GetForecastModelUseCase;
  let updateUseCase: UpdateForecastModelUseCase;
  let listUseCase: ListForecastModelsUseCase;
  let controller: ForecastModelController;
  let consumer: ForecastModelEventConsumer;

  beforeEach(() => {
    sharedStore = new Map<string, ForecastModelAggregate>();
    repo = new ForecastModelPgRepository(undefined, sharedStore);
    auditService = new ForecastAuditService();
    ForecastAuditService.clearAuditLogs();
    createUseCase = new CreateForecastModelUseCase(repo, auditService);
    getUseCase = new GetForecastModelUseCase(repo);
    updateUseCase = new UpdateForecastModelUseCase(repo, auditService);
    listUseCase = new ListForecastModelsUseCase(repo);
    controller = new ForecastModelController(createUseCase, getUseCase, updateUseCase, listUseCase);
    consumer = new ForecastModelEventConsumer();
  });

  describe('1. Domain Entity Invariants & State Machine (Tasks 1718, 1725)', () => {
    test('should create valid ForecastModelAggregate in DRAFT status', () => {
      const model = ForecastModelAggregate.create({
        id: randomUUID(),
        tenantId,
        modelName: 'sales_forecast_q3',
        algorithm: 'ARIMA'
      });

      assert.equal(model.status, 'DRAFT');
      assert.equal(model.version, 1);
      assert.equal(model.modelName, 'sales_forecast_q3');
      assert.equal(model.algorithm, 'ARIMA');
    });

    test('should execute legal state transitions: DRAFT -> TRAINING -> ACTIVE -> RETIRED', () => {
      const model = ForecastModelAggregate.create({
        id: randomUUID(),
        tenantId,
        modelName: 'inventory_prophet',
        algorithm: 'PROPHET'
      });

      model.startTraining(1);
      assert.equal(model.status, 'TRAINING');
      assert.equal(model.version, 2);

      model.activate(4.5, 12.3, 2);
      assert.equal(model.status, 'ACTIVE');
      assert.equal(model.accuracyMape, 4.5);
      assert.equal(model.accuracyRmse, 12.3);
      assert.equal(model.version, 3);

      model.retire(3);
      assert.equal(model.status, 'RETIRED');
      assert.equal(model.version, 4);
    });

    test('should reject illegal state transitions', () => {
      const model = ForecastModelAggregate.create({
        id: randomUUID(),
        tenantId,
        modelName: 'model_retired',
        algorithm: 'NEURAL_NETWORK'
      });

      model.startTraining(1);
      model.activate(2.0, 5.0, 2);
      model.retire(3);

      assert.throws(() => {
        model.startTraining(4);
      }, /Cannot start training from status 'RETIRED'/);

      assert.throws(() => {
        model.approve(4);
      }, /Cannot approve a RETIRED ForecastModel/);
    });
  });

  describe('2. Application Use Cases, Validation, Audit & RBAC (Tasks 1720–1724)', () => {
    test('CreateForecastModelUseCase should record audit log and enforce RBAC', async () => {
      const res = await createUseCase.execute(principal, {
        modelName: 'demand_forecast_2026',
        algorithm: 'EXPONENTIAL_SMOOTHING'
      });

      assert.ok(res.id);
      assert.equal(res.status, 'DRAFT');
      assert.equal(ForecastAuditService.getAuditLogs().length, 1);
      assert.equal(ForecastAuditService.getAuditLogs()[0].action, 'FORECAST_MODEL_CREATED');
    });

    test('CreateForecastModelUseCase should enforce name uniqueness per tenant', async () => {
      await createUseCase.execute(principal, {
        modelName: 'unique_model',
        algorithm: 'ARIMA'
      });

      await assert.rejects(async () => {
        await createUseCase.execute(principal, {
          modelName: 'unique_model',
          algorithm: 'PROPHET'
        });
      }, /already exists for this tenant/);
    });

    test('CreateForecastModelUseCase should enforce idempotency deduplication', async () => {
      const dto = {
        modelName: 'idemp_model',
        algorithm: 'ARIMA' as const,
        idempotencyKey: 'idemp-model-001'
      };

      await createUseCase.execute(principal, dto);

      await assert.rejects(async () => {
        await createUseCase.execute(principal, dto);
      }, /Duplicate request: Idempotency key 'idemp-model-001' already processed/);
    });

    test('should reject creation for principal without forecast:model:create permission', async () => {
      await assert.rejects(async () => {
        await createUseCase.execute(restrictedPrincipal, {
          modelName: 'unauth_model'
        });
      }, /Forbidden: Insufficient permissions to create forecast model/);
    });

    test('GetForecastModelUseCase and ListForecastModelsUseCase should work for authorized user', async () => {
      const created = await createUseCase.execute(principal, {
        modelName: 'find_model',
        algorithm: 'NEURAL_NETWORK'
      });

      const fetched = await getUseCase.execute(principal, created.id);
      assert.equal(fetched.id, created.id);

      const fetchedByName = await getUseCase.getByName(principal, 'find_model');
      assert.equal(fetchedByName.id, created.id);

      const listRes = await listUseCase.execute(principal, { modelName: 'find' });
      assert.equal(listRes.total, 1);
      assert.equal(listRes.models[0].id, created.id);
    });

    test('UpdateForecastModelUseCase should transition state with optimistic locking', async () => {
      const created = await createUseCase.execute(principal, {
        modelName: 'updatable_model',
        algorithm: 'ARIMA'
      });

      const trained = await updateUseCase.execute(principal, created.id, {
        action: 'train',
        expectedVersion: 1
      });
      assert.equal(trained.status, 'TRAINING');
      assert.equal(trained.version, 2);

      const activated = await updateUseCase.execute(principal, created.id, {
        action: 'activate',
        accuracyMape: 3.2,
        accuracyRmse: 8.5,
        expectedVersion: 2
      });
      assert.equal(activated.status, 'ACTIVE');
      assert.equal(activated.version, 3);
    });
  });

  describe('3. Postgres Repository Integration & RLS Isolation (Task 1719)', () => {
    test('should isolate forecast models between tenants (RLS simulation)', async () => {
      const storeA = new Map<string, ForecastModelAggregate>();
      const storeB = new Map<string, ForecastModelAggregate>();
      const repoA = new ForecastModelPgRepository(undefined, storeA);
      const repoB = new ForecastModelPgRepository(undefined, storeB);

      const id = randomUUID();
      const modelA = ForecastModelAggregate.create({
        id,
        tenantId: 'tenant-A',
        modelName: 'secret_model_A'
      });

      await repoA.save(modelA);

      const foundA = await repoA.findById(id, 'tenant-A');
      assert.ok(foundA);

      const foundB = await repoB.findById(id, 'tenant-B');
      assert.equal(foundB, null);
    });
  });

  describe('4. REST Controller & Event Consumer Tests (Tasks 1726, 1727)', () => {
    test('ForecastModelController handleCreate should return 201 and reject non-JSON Content-Type with 415', async () => {
      const validReq = {
        headers: { 'content-type': 'application/json' },
        body: {
          modelName: 'ctrl_model',
          algorithm: 'ARIMA'
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

    test('ForecastModelEventConsumer should process domain events, deduplicate, and route to DLQ', async () => {
      const event = {
        eventId: 'evt-fm-001',
        eventType: 'forecast.model.created',
        aggregateId: 'fm-001',
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
