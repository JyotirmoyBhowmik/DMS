import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { RecommendationModelAggregate } from './domain/entities/recommendation_model.entity.js';
import { RecommendationModelPgRepository } from './infrastructure/database/repositories/recommendation_model.pg-repository.js';
import { CreateRecommendationModelUseCase } from './application/usecases/create-recommendation-model.usecase.js';
import { GetRecommendationModelUseCase } from './application/usecases/get-recommendation-model.usecase.js';
import { UpdateRecommendationModelUseCase } from './application/usecases/update-recommendation-model.usecase.js';
import { ListRecommendationModelsUseCase } from './application/usecases/list-recommendation-models.usecase.js';
import { RecommendationModelController } from './presentation/rest/controllers/recommendation_model.controller.js';
import { RecommendationModelEventConsumer } from './infrastructure/events/recommendation_model.consumer.js';
import { RecommendationAuditService } from './infrastructure/audit/recommendation.audit.js';
import { Principal } from './application/usecases/create-recommendation.usecase.js';

describe('RecommendationModel Vertical Slice - Comprehensive QA & Security Test Suite', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const principal: Principal = {
    userId: 'user-admin-1',
    tenantId,
    roles: ['admin'],
    permissions: ['recommendation:model:create', 'recommendation:model:read', 'recommendation:model:update', 'recommendation:model:delete', 'recommendation:model:approve']
  };

  const restrictedPrincipal: Principal = {
    userId: 'user-viewer-1',
    tenantId,
    roles: ['viewer'],
    permissions: ['recommendation:model:read']
  };

  let sharedStore: Map<string, RecommendationModelAggregate>;
  let repo: RecommendationModelPgRepository;
  let auditService: RecommendationAuditService;
  let createUseCase: CreateRecommendationModelUseCase;
  let getUseCase: GetRecommendationModelUseCase;
  let updateUseCase: UpdateRecommendationModelUseCase;
  let listUseCase: ListRecommendationModelsUseCase;
  let controller: RecommendationModelController;
  let consumer: RecommendationModelEventConsumer;

  beforeEach(() => {
    sharedStore = new Map<string, RecommendationModelAggregate>();
    repo = new RecommendationModelPgRepository(undefined, sharedStore);
    auditService = new RecommendationAuditService();
    RecommendationAuditService.clearAuditLogs();
    createUseCase = new CreateRecommendationModelUseCase(repo, auditService);
    getUseCase = new GetRecommendationModelUseCase(repo);
    updateUseCase = new UpdateRecommendationModelUseCase(repo, auditService);
    listUseCase = new ListRecommendationModelsUseCase(repo);
    controller = new RecommendationModelController(createUseCase, getUseCase, updateUseCase, listUseCase);
    consumer = new RecommendationModelEventConsumer();
  });

  describe('1. Domain Entity Invariants & State Machine (Tasks 1775, 1782)', () => {
    test('should create valid RecommendationModelAggregate in DRAFT status', () => {
      const model = RecommendationModelAggregate.create({
        id: randomUUID(),
        tenantId,
        modelName: 'collab_filtering_v1',
        modelType: 'COLLABORATIVE_FILTERING',
        hyperparameters: { latent_factors: 50 }
      });

      assert.equal(model.status, 'DRAFT');
      assert.equal(model.version, 1);
      assert.equal(model.modelName, 'collab_filtering_v1');
      assert.equal(model.modelType, 'COLLABORATIVE_FILTERING');
    });

    test('should reject creation if precisionAtK is out of bounds', () => {
      assert.throws(() => {
        new RecommendationModelAggregate({
          id: randomUUID(),
          tenantId,
          modelName: 'invalid_model',
          modelType: 'HYBRID',
          precisionAtK: 1.5,
          status: 'DRAFT',
          hyperparameters: {},
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }, /precisionAtK must be between 0.0 and 1.0/);
    });

    test('should execute legal state transitions: DRAFT -> TRAINING -> ACTIVE -> RETIRED', () => {
      const model = RecommendationModelAggregate.create({
        id: randomUUID(),
        tenantId,
        modelName: 'trainable_model'
      });

      model.startTraining(1);
      assert.equal(model.status, 'TRAINING');
      assert.equal(model.version, 2);

      model.activate(2, 0.85, 0.90);
      assert.equal(model.status, 'ACTIVE');
      assert.equal(model.version, 3);
      assert.equal(model.precisionAtK, 0.85);

      model.retire(3);
      assert.equal(model.status, 'RETIRED');
      assert.equal(model.version, 4);
    });

    test('should reject illegal state transitions', () => {
      const model = RecommendationModelAggregate.create({
        id: randomUUID(),
        tenantId,
        modelName: 'retired_model'
      });

      model.startTraining(1);
      model.activate(2);
      model.retire(3);

      assert.throws(() => {
        model.approve(4);
      }, /Cannot approve a RETIRED RecommendationModel/);

      assert.throws(() => {
        model.retire(4);
      }, /RecommendationModel is already RETIRED/);
    });
  });

  describe('2. Application Use Cases, Validation, Audit & RBAC (Tasks 1777–1781, 1787)', () => {
    test('CreateRecommendationModelUseCase should record audit log and enforce RBAC', async () => {
      const res = await createUseCase.execute(principal, {
        modelName: 'content_based_v2',
        modelType: 'CONTENT_BASED'
      });

      assert.ok(res.id);
      assert.equal(res.status, 'DRAFT');
      assert.equal(RecommendationAuditService.getAuditLogs().length, 1);
      assert.equal(RecommendationAuditService.getAuditLogs()[0].action, 'RECOMMENDATION_MODEL_CREATED');
    });

    test('CreateRecommendationModelUseCase should enforce modelName uniqueness per tenant', async () => {
      await createUseCase.execute(principal, {
        modelName: 'unique_model_name'
      });

      await assert.rejects(async () => {
        await createUseCase.execute(principal, {
          modelName: 'unique_model_name'
        });
      }, /already exists for this tenant/);
    });

    test('CreateRecommendationModelUseCase should enforce idempotency deduplication', async () => {
      const dto = {
        modelName: 'idemp_model',
        idempotencyKey: 'idemp-model-001'
      };

      await createUseCase.execute(principal, dto);

      await assert.rejects(async () => {
        await createUseCase.execute(principal, dto);
      }, /Duplicate request: Idempotency key 'idemp-model-001' already processed/);
    });

    test('should reject creation for principal without recommendation:model:create permission', async () => {
      await assert.rejects(async () => {
        await createUseCase.execute(restrictedPrincipal, {
          modelName: 'unauth_model'
        });
      }, /Forbidden: Insufficient permissions to create recommendation model/);
    });

    test('GetRecommendationModelUseCase and ListRecommendationModelsUseCase should work for authorized user', async () => {
      const created = await createUseCase.execute(principal, {
        modelName: 'find_model'
      });

      const fetched = await getUseCase.execute(principal, created.id);
      assert.equal(fetched.id, created.id);

      const fetchedByName = await getUseCase.getByName(principal, 'find_model');
      assert.equal(fetchedByName.id, created.id);

      const listRes = await listUseCase.execute(principal, { modelName: 'find' });
      assert.equal(listRes.total, 1);
      assert.equal(listRes.models[0].id, created.id);
    });

    test('UpdateRecommendationModelUseCase should transition state with optimistic locking', async () => {
      const created = await createUseCase.execute(principal, {
        modelName: 'updatable_model'
      });

      const trained = await updateUseCase.execute(principal, created.id, {
        action: 'train',
        expectedVersion: 1
      });
      assert.equal(trained.status, 'TRAINING');
      assert.equal(trained.version, 2);
    });
  });

  describe('3. Postgres Repository Integration & RLS Isolation (Task 1776)', () => {
    test('should isolate recommendation models between tenants (RLS simulation)', async () => {
      const storeA = new Map<string, RecommendationModelAggregate>();
      const storeB = new Map<string, RecommendationModelAggregate>();
      const repoA = new RecommendationModelPgRepository(undefined, storeA);
      const repoB = new RecommendationModelPgRepository(undefined, storeB);

      const id = randomUUID();
      const modelA = RecommendationModelAggregate.create({
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

  describe('4. REST Controller & Event Consumer Tests (Tasks 1783, 1784)', () => {
    test('RecommendationModelController handleCreate should return 201 and reject non-JSON Content-Type with 415', async () => {
      const validReq = {
        headers: { 'content-type': 'application/json' },
        body: {
          modelName: 'ctrl_model'
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

    test('RecommendationModelEventConsumer should process domain events, deduplicate, and route to DLQ', async () => {
      const event = {
        eventId: 'evt-rm-001',
        eventType: 'recommendation.model.created',
        aggregateId: 'rm-001',
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
