import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert';
import { KPIAchievement } from './domain/entities/kpi-achievement.js';
import { KPIAchievementPgRepository } from './infrastructure/database/repositories/kpi-achievement.pg-repository.js';
import {
  CreateKPIAchievementUseCase,
  UpdateKPIAchievementUseCase,
  GetKPIAchievementUseCase,
  ListKPIAchievementsUseCase,
  VisitCompletedKPIConsumer,
} from './application/usecases/kpi-achievement/kpi-achievement.usecases.js';
import { AuditController } from '../../audit-service/src/presentation/rest/controllers/audit.controller.js';
import { InboundEvent } from '@dms/pkg-events';

const tenantId = '00000000-0000-0000-0000-000000000001';
const otherTenantId = '00000000-0000-0000-0000-000000000002';
const agentId = '00000000-0000-0000-0000-00000000000a';
const otherAgentId = '00000000-0000-0000-0000-00000000000b';

const adminPrincipal = {
  id: 'admin-user-uuid',
  tenantId,
  roles: ['admin'],
};

const agentPrincipal = {
  id: agentId,
  tenantId,
  roles: ['agent'],
};

const otherAgentPrincipal = {
  id: otherAgentId,
  tenantId,
  roles: ['agent'],
};

const crossTenantPrincipal = {
  id: 'cross-user-uuid',
  tenantId: otherTenantId,
  roles: ['admin'],
};

beforeEach(() => {
  KPIAchievementPgRepository.clearStore();
  AuditController.getInstance().getRepository().clear();
});

describe('SFA KPIAchievement Slice Tests', () => {
  describe('1. Domain Entity aggregate', () => {
    test('Should create and reconstitute KPIAchievement and validate invariants', () => {
      const target = KPIAchievement.create({
        id: 'kpi-1',
        tenantId,
        agentId,
        kpiType: 'visits',
        periodMonth: 6,
        periodYear: 2026,
        targetValue: 100,
      });

      assert.strictEqual(target.id, 'kpi-1');
      assert.strictEqual(target.tenantId, tenantId);
      assert.strictEqual(target.periodMonth, 6);
      assert.strictEqual(target.periodYear, 2026);
      assert.strictEqual(target.targetValue, 100);
      assert.strictEqual(target.achievedValue, 0);
      assert.strictEqual(target.status, 'DRAFT');

      // Invalid ID
      assert.throws(() => {
        KPIAchievement.create({
          id: '',
          tenantId,
          agentId,
          kpiType: 'visits',
          periodMonth: 6,
          periodYear: 2026,
          targetValue: 100,
        });
      }, /ID cannot be empty/);

      // Invalid Period Month
      assert.throws(() => {
        KPIAchievement.create({
          id: 'kpi-1',
          tenantId,
          agentId,
          kpiType: 'visits',
          periodMonth: 13,
          periodYear: 2026,
          targetValue: 100,
        });
      }, /periodMonth must be between 1 and 12/);

      // Negative target value
      assert.throws(() => {
        KPIAchievement.create({
          id: 'kpi-1',
          tenantId,
          agentId,
          kpiType: 'visits',
          periodMonth: 6,
          periodYear: 2026,
          targetValue: -100,
        });
      }, /Target value cannot be negative/);
    });

    test('Should enforce state transitions rules', () => {
      const target = KPIAchievement.create({
        id: 'kpi-1',
        tenantId,
        agentId,
        kpiType: 'visits',
        periodMonth: 6,
        periodYear: 2026,
        targetValue: 100,
      });

      // Draft modification
      target.updateTargetValue(150);
      assert.strictEqual(target.targetValue, 150);

      // Submit
      target.submit();
      assert.strictEqual(target.status, 'SUBMITTED');

      // Cannot modify target in SUBMITTED status
      assert.throws(() => {
        target.updateTargetValue(200);
      }, /Can only modify target value in DRAFT status/);

      // Reject or approve
      target.approve();
      assert.strictEqual(target.status, 'APPROVED');

      // Update progress
      target.updateProgress(45);
      assert.strictEqual(target.achievedValue, 45);
      assert.strictEqual(target.progressPercentage, 30);
    });
  });

  describe('2. Postgres Repository implementation', () => {
    test('Should save, find, and delete KPI targets in repository', async () => {
      const repo = new KPIAchievementPgRepository();
      const target = KPIAchievement.create({
        id: 'kpi-99',
        tenantId,
        agentId,
        kpiType: 'orders',
        periodMonth: 7,
        periodYear: 2026,
        targetValue: 50,
      });

      await repo.save(target, tenantId);

      const found = await repo.findById('kpi-99', tenantId);
      assert.ok(found);
      assert.strictEqual(found.id, 'kpi-99');
      assert.strictEqual(found.kpiType, 'orders');

      const list = await repo.findByAgentAndPeriod(agentId, 7, 2026, tenantId);
      assert.strictEqual(list.length, 1);

      await repo.delete('kpi-99', tenantId);
      const deleted = await repo.findById('kpi-99', tenantId);
      assert.strictEqual(deleted, null);
    });
  });

  describe('3. CRUD Use Cases execution', () => {
    test('Should execute Create, Get, Update, and List Use Cases with RBAC', async () => {
      const repo = new KPIAchievementPgRepository();
      const createUseCase = new CreateKPIAchievementUseCase(undefined, repo);
      const getUseCase = new GetKPIAchievementUseCase(undefined, repo);
      const updateUseCase = new UpdateKPIAchievementUseCase(undefined, repo);
      const listUseCase = new ListKPIAchievementsUseCase(undefined, repo);

      // Create (Admin)
      const target = await createUseCase.execute(adminPrincipal, {
        id: 'kpi-usecase',
        tenantId,
        agentId,
        kpiType: 'orders',
        periodMonth: 10,
        periodYear: 2026,
        targetValue: 200,
      });

      assert.strictEqual(target.id, 'kpi-usecase');
      assert.strictEqual(target.targetValue, 200);

      // Create Agent Role Denied
      await assert.rejects(async () => {
        await createUseCase.execute(agentPrincipal, {
          id: 'kpi-agent-failed',
          tenantId,
          agentId,
          kpiType: 'orders',
          periodMonth: 10,
          periodYear: 2026,
          targetValue: 200,
        });
      }, /Forbidden: Insufficient permissions to create KPI targets/);

      // Get (Agent)
      const fetched = await getUseCase.execute(agentPrincipal, 'kpi-usecase', tenantId);
      assert.strictEqual(fetched.id, 'kpi-usecase');

      // Update Target (Admin)
      const updated = await updateUseCase.execute(adminPrincipal, {
        id: 'kpi-usecase',
        tenantId,
        targetValue: 250,
        status: 'SUBMITTED',
        version: 1,
      });
      assert.strictEqual(updated.targetValue, 250);
      assert.strictEqual(updated.status, 'SUBMITTED');

      // Update Conflict Version Check
      await assert.rejects(async () => {
        await updateUseCase.execute(adminPrincipal, {
          id: 'kpi-usecase',
          tenantId,
          targetValue: 300,
          version: 1, // Stale version (should be 2 after previous update)
        });
      }, /Optimistic locking conflict/);

      // List targets (Agent)
      const list = await listUseCase.execute(agentPrincipal, {
        tenantId,
        agentId,
      });
      assert.strictEqual(list.items.length, 1);
    });

    test('Should audit modifications properly', async () => {
      const repo = new KPIAchievementPgRepository();
      const createUseCase = new CreateKPIAchievementUseCase(undefined, repo);

      await createUseCase.execute(adminPrincipal, {
        id: 'kpi-audit',
        tenantId,
        agentId,
        kpiType: 'visits',
        periodMonth: 11,
        periodYear: 2026,
        targetValue: 120,
      });

      const auditRepo = AuditController.getInstance().getRepository();
      const logs = await auditRepo.getAllBlocks();
      assert.ok(logs.length > 0);
      const hasCreated = logs.some((l: any) => l.data && l.data.type === 'kpi_achievement.created');
      assert.ok(hasCreated);
    });
  });

  describe('4. Idempotent Consumer execution', () => {
    test('Should progressively increment visits achieved progress on visit.completed', async () => {
      const repo = new KPIAchievementPgRepository();
      const target = KPIAchievement.create({
        id: 'kpi-consumer-test',
        tenantId,
        agentId,
        kpiType: 'visits',
        periodMonth: 6,
        periodYear: 2026,
        targetValue: 10,
      });
      target.submit();
      target.approve();
      await repo.save(target, tenantId);

      const mockDb: any = {
        transaction: async (cb: any) => {
          return cb(repo);
        },
      };

      const mockBroker: any = {
        subscribe: () => {},
      };

      const consumer = new VisitCompletedKPIConsumer(mockDb, mockBroker);
      
      const event: InboundEvent<any> = {
        eventId: 'evt-visit-completed-99',
        eventType: 'visit.completed.v1',
        payload: {
          agentId,
          timestamp: '2026-06-15T10:00:00Z',
        },
        tenantId,
      };

      // Handle first time
      await (consumer as any).handleEvent(event);
      
      const found = await repo.findById('kpi-consumer-test', tenantId);
      assert.strictEqual(found?.achievedValue, 1);
    });
  });
});
