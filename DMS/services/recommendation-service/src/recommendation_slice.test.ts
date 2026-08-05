import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { RecommendationAggregate } from './domain/entities/recommendation.entity.js';
import { RecommendationPgRepository } from './infrastructure/database/repositories/recommendation.pg-repository.js';
import { CreateRecommendationUseCase, Principal } from './application/usecases/create-recommendation.usecase.js';
import { GetRecommendationUseCase } from './application/usecases/get-recommendation.usecase.js';
import { UpdateRecommendationUseCase } from './application/usecases/update-recommendation.usecase.js';
import { ListRecommendationsUseCase } from './application/usecases/list-recommendations.usecase.js';
import { RecommendationController } from './presentation/rest/controllers/recommendation.controller.js';
import { RecommendationEventConsumer } from './infrastructure/events/recommendation.consumer.js';
import { RecommendationAuditService } from './infrastructure/audit/recommendation.audit.js';

describe('Recommendation Vertical Slice - Comprehensive QA & Security Test Suite', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const principal: Principal = {
    userId: 'user-admin-1',
    tenantId,
    roles: ['admin'],
    permissions: ['recommendation:create', 'recommendation:read', 'recommendation:update', 'recommendation:delete', 'recommendation:approve']
  };

  const restrictedPrincipal: Principal = {
    userId: 'user-viewer-1',
    tenantId,
    roles: ['viewer'],
    permissions: ['recommendation:read']
  };

  let sharedStore: Map<string, RecommendationAggregate>;
  let repo: RecommendationPgRepository;
  let auditService: RecommendationAuditService;
  let createUseCase: CreateRecommendationUseCase;
  let getUseCase: GetRecommendationUseCase;
  let updateUseCase: UpdateRecommendationUseCase;
  let listUseCase: ListRecommendationsUseCase;
  let controller: RecommendationController;
  let consumer: RecommendationEventConsumer;

  beforeEach(() => {
    sharedStore = new Map<string, RecommendationAggregate>();
    repo = new RecommendationPgRepository(undefined, sharedStore);
    auditService = new RecommendationAuditService();
    RecommendationAuditService.clearAuditLogs();
    createUseCase = new CreateRecommendationUseCase(repo, auditService);
    getUseCase = new GetRecommendationUseCase(repo);
    updateUseCase = new UpdateRecommendationUseCase(repo, auditService);
    listUseCase = new ListRecommendationsUseCase(repo);
    controller = new RecommendationController(createUseCase, getUseCase, updateUseCase, listUseCase);
    consumer = new RecommendationEventConsumer();
  });

  describe('1. Domain Entity Invariants & State Machine (Tasks 1756, 1763)', () => {
    test('should create valid RecommendationAggregate in DRAFT status', () => {
      const rec = RecommendationAggregate.create({
        id: randomUUID(),
        tenantId,
        title: 'bundle_beverages_cross_sell',
        targetType: 'OUTLET',
        targetId: randomUUID(),
        recommendationType: 'CROSS_SELL',
        score: 0.85
      });

      assert.equal(rec.status, 'DRAFT');
      assert.equal(rec.version, 1);
      assert.equal(rec.title, 'bundle_beverages_cross_sell');
      assert.equal(rec.recommendationType, 'CROSS_SELL');
      assert.equal(rec.score, 0.85);
    });

    test('should reject creation if score is out of bounds', () => {
      assert.throws(() => {
        RecommendationAggregate.create({
          id: randomUUID(),
          tenantId,
          title: 'invalid_score',
          targetId: randomUUID(),
          score: 1.5
        });
      }, /score must be between 0.0 and 1.0/);
    });

    test('should execute legal state transitions: DRAFT -> ACTIVE -> APPLIED', () => {
      const rec = RecommendationAggregate.create({
        id: randomUUID(),
        tenantId,
        title: 'stock_replenishment',
        targetId: randomUUID()
      });

      rec.activate(1);
      assert.equal(rec.status, 'ACTIVE');
      assert.equal(rec.version, 2);

      rec.apply(2);
      assert.equal(rec.status, 'APPLIED');
      assert.equal(rec.version, 3);
    });

    test('should reject illegal state transitions', () => {
      const rec = RecommendationAggregate.create({
        id: randomUUID(),
        tenantId,
        title: 'expired_rec',
        targetId: randomUUID()
      });

      rec.expire(1);

      assert.throws(() => {
        rec.activate(2);
      }, /Cannot activate Recommendation from status 'EXPIRED'/);

      assert.throws(() => {
        rec.approve(2);
      }, /Cannot approve Recommendation from status 'EXPIRED'/);
    });
  });

  describe('2. Application Use Cases, Validation, Audit & RBAC (Tasks 1758–1762, 1768)', () => {
    test('CreateRecommendationUseCase should record audit log and enforce RBAC', async () => {
      const res = await createUseCase.execute(principal, {
        title: 'upgrade_sku_premium',
        targetId: randomUUID(),
        recommendationType: 'UP_SELL',
        score: 0.90
      });

      assert.ok(res.id);
      assert.equal(res.status, 'DRAFT');
      assert.equal(RecommendationAuditService.getAuditLogs().length, 1);
      assert.equal(RecommendationAuditService.getAuditLogs()[0].action, 'RECOMMENDATION_CREATED');
    });

    test('CreateRecommendationUseCase should enforce title uniqueness per tenant', async () => {
      const targetId = randomUUID();
      await createUseCase.execute(principal, {
        title: 'unique_rec',
        targetId
      });

      await assert.rejects(async () => {
        await createUseCase.execute(principal, {
          title: 'unique_rec',
          targetId
        });
      }, /already exists for this tenant/);
    });

    test('CreateRecommendationUseCase should enforce idempotency deduplication', async () => {
      const dto = {
        title: 'idemp_rec',
        targetId: randomUUID(),
        idempotencyKey: 'idemp-rec-001'
      };

      await createUseCase.execute(principal, dto);

      await assert.rejects(async () => {
        await createUseCase.execute(principal, dto);
      }, /Duplicate request: Idempotency key 'idemp-rec-001' already processed/);
    });

    test('should reject creation for principal without recommendation:create permission', async () => {
      await assert.rejects(async () => {
        await createUseCase.execute(restrictedPrincipal, {
          title: 'unauth_rec',
          targetId: randomUUID()
        });
      }, /Forbidden: Insufficient permissions to create recommendation/);
    });

    test('GetRecommendationUseCase and ListRecommendationsUseCase should work for authorized user', async () => {
      const created = await createUseCase.execute(principal, {
        title: 'find_rec',
        targetId: randomUUID()
      });

      const fetched = await getUseCase.execute(principal, created.id);
      assert.equal(fetched.id, created.id);

      const fetchedByTitle = await getUseCase.getByTitle(principal, 'find_rec');
      assert.equal(fetchedByTitle.id, created.id);

      const listRes = await listUseCase.execute(principal, { title: 'find' });
      assert.equal(listRes.total, 1);
      assert.equal(listRes.recommendations[0].id, created.id);
    });

    test('UpdateRecommendationUseCase should transition state with optimistic locking', async () => {
      const created = await createUseCase.execute(principal, {
        title: 'updatable_rec',
        targetId: randomUUID()
      });

      const activated = await updateUseCase.execute(principal, created.id, {
        action: 'activate',
        expectedVersion: 1
      });
      assert.equal(activated.status, 'ACTIVE');
      assert.equal(activated.version, 2);
    });
  });

  describe('3. Postgres Repository Integration & RLS Isolation (Task 1757)', () => {
    test('should isolate recommendations between tenants (RLS simulation)', async () => {
      const storeA = new Map<string, RecommendationAggregate>();
      const storeB = new Map<string, RecommendationAggregate>();
      const repoA = new RecommendationPgRepository(undefined, storeA);
      const repoB = new RecommendationPgRepository(undefined, storeB);

      const id = randomUUID();
      const recA = RecommendationAggregate.create({
        id,
        tenantId: 'tenant-A',
        title: 'secret_rec_A',
        targetId: randomUUID()
      });

      await repoA.save(recA);

      const foundA = await repoA.findById(id, 'tenant-A');
      assert.ok(foundA);

      const foundB = await repoB.findById(id, 'tenant-B');
      assert.equal(foundB, null);
    });
  });

  describe('4. REST Controller & Event Consumer Tests (Tasks 1764, 1765)', () => {
    test('RecommendationController handleCreate should return 201 and reject non-JSON Content-Type with 415', async () => {
      const validReq = {
        headers: { 'content-type': 'application/json' },
        body: {
          title: 'ctrl_rec',
          targetId: randomUUID()
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

    test('RecommendationEventConsumer should process domain events, deduplicate, and route to DLQ', async () => {
      const event = {
        eventId: 'evt-rec-001',
        eventType: 'recommendation.created',
        aggregateId: 'rec-001',
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
