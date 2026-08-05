import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert';
import { SalesTarget } from './domain/entities/sales-target.js';
import { Money } from './domain/value-objects/money.js';
import { SalesTargetPgRepository } from './infrastructure/database/repositories/sales-target.pg-repository.js';
import {
  CreateSalesTargetUseCase,
  UpdateSalesTargetUseCase,
  GetSalesTargetUseCase,
  ListSalesTargetsUseCase,
  OrderPlacedSalesTargetConsumer,
} from './application/usecases/sales-target/sales-target.usecases.js';
import { AuditController } from '../../audit-service/src/presentation/rest/controllers/audit.controller.js';
import { InboundEvent, EventEnvelope } from '@dms/pkg-events';

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
  SalesTargetPgRepository.clearStore();
  AuditController.getInstance().getRepository().clear();
});

describe('SFA SalesTarget Slice Tests', () => {
  describe('1. Domain Entity aggregate', () => {
    test('Should create and reconstitute SalesTarget and validate invariants', () => {
      const target = SalesTarget.create({
        id: 'target-1',
        tenantId,
        agentId,
        periodMonth: 6,
        periodYear: 2026,
        targetAmount: Money.fromCents(100000), // 1000.00
        targetType: 'volume',
      });

      assert.strictEqual(target.id, 'target-1');
      assert.strictEqual(target.tenantId, tenantId);
      assert.strictEqual(target.periodMonth, 6);
      assert.strictEqual(target.periodYear, 2026);
      assert.strictEqual(target.targetAmount.amount, 1000.00);
      assert.strictEqual(target.achievedAmount.amount, 0);
      assert.strictEqual(target.status, 'DRAFT');

      // Invalid ID
      assert.throws(() => {
        SalesTarget.create({
          id: '',
          tenantId,
          agentId,
          periodMonth: 6,
          periodYear: 2026,
          targetAmount: Money.fromCents(1000),
          targetType: 'volume',
        });
      }, /ID cannot be empty/);

      // Invalid Period Month
      assert.throws(() => {
        SalesTarget.create({
          id: 'target-1',
          tenantId,
          agentId,
          periodMonth: 13,
          periodYear: 2026,
          targetAmount: Money.fromCents(1000),
          targetType: 'volume',
        });
      }, /periodMonth must be between 1 and 12/);

      // Negative target amount
      assert.throws(() => {
        SalesTarget.create({
          id: 'target-1',
          tenantId,
          agentId,
          periodMonth: 6,
          periodYear: 2026,
          targetAmount: Money.fromCents(-500),
          targetType: 'volume',
        });
      }, /Money amount cannot be negative/);
    });

    test('Should enforce state transitions rules', () => {
      const target = SalesTarget.create({
        id: 'target-1',
        tenantId,
        agentId,
        periodMonth: 6,
        periodYear: 2026,
        targetAmount: Money.fromCents(100000),
        targetType: 'volume',
      });

      // Draft modification
      target.updateTargetAmount(Money.fromCents(150000));
      assert.strictEqual(target.targetAmount.amount, 1500.00);

      // Cannot add achievement in Draft
      assert.throws(() => {
        target.addAchievement(Money.fromCents(100));
      }, /Can only add achievement to ACTIVE sales targets/);

      // Activate
      target.activate();
      assert.strictEqual(target.status, 'ACTIVE');

      // Cannot modify target in Active status
      assert.throws(() => {
        target.updateTargetAmount(Money.fromCents(200000));
      }, /Can only modify target amount in DRAFT status/);

      // Add achievement
      target.addAchievement(Money.fromCents(50000));
      assert.strictEqual(target.achievedAmount.amount, 500.00);
      assert.strictEqual(target.progressPercentage, 33.33333333333333);
      assert.strictEqual(target.status, 'ACTIVE');

      // Add completion achievement (reaches 100%)
      target.addAchievement(Money.fromCents(100000));
      assert.strictEqual(target.achievedAmount.amount, 1500.00);
      assert.strictEqual(target.progressPercentage, 100);
      assert.strictEqual(target.status, 'COMPLETED'); // State transition triggered automatically
    });
  });

  describe('2. Postgres Repository implementation', () => {
    test('Should save, find, and delete sales targets in repository', async () => {
      const repo = new SalesTargetPgRepository();
      const target = SalesTarget.create({
        id: 'target-99',
        tenantId,
        agentId,
        periodMonth: 7,
        periodYear: 2026,
        targetAmount: Money.fromCents(50000),
        targetType: 'value',
      });

      await repo.save(target, tenantId);

      const found = await repo.findById('target-99', tenantId);
      assert.ok(found);
      assert.strictEqual(found.id, 'target-99');
      assert.strictEqual(found.targetType, 'value');

      const list = await repo.findByAgentAndPeriod(agentId, 7, 2026, tenantId);
      assert.strictEqual(list.length, 1);

      await repo.delete('target-99', tenantId);
      const deleted = await repo.findById('target-99', tenantId);
      assert.strictEqual(deleted, null);
    });
  });

  describe('3. CRUD Use Cases execution', () => {
    test('Should execute Create, Get, Update, and List Use Cases with RBAC', async () => {
      const repo = new SalesTargetPgRepository();
      const createUseCase = new CreateSalesTargetUseCase(undefined, repo);
      const getUseCase = new GetSalesTargetUseCase(undefined, repo);
      const updateUseCase = new UpdateSalesTargetUseCase(undefined, repo);
      const listUseCase = new ListSalesTargetsUseCase(undefined, repo);

      // Create (Admin)
      const target = await createUseCase.execute(adminPrincipal, {
        id: 'target-usecase',
        tenantId,
        agentId,
        periodMonth: 10,
        periodYear: 2026,
        targetAmount: 2000,
        targetType: 'volume',
      });

      assert.strictEqual(target.id, 'target-usecase');
      assert.strictEqual(target.targetAmount.amount, 2000);

      // Reject create (Agent)
      await assert.rejects(async () => {
        await createUseCase.execute(agentPrincipal, {
          tenantId,
          agentId,
          periodMonth: 10,
          periodYear: 2026,
          targetAmount: 2000,
          targetType: 'value',
        });
      }, /Insufficient permissions/);

      // Reject cross-tenant
      await assert.rejects(async () => {
        await createUseCase.execute(crossTenantPrincipal, {
          tenantId,
          agentId,
          periodMonth: 10,
          periodYear: 2026,
          targetAmount: 2000,
          targetType: 'value',
        });
      }, /Tenant context mismatch/);

      // Get target details
      const fetched = await getUseCase.execute(agentPrincipal, 'target-usecase', tenantId);
      assert.strictEqual(fetched.id, 'target-usecase');

      // Other agent cannot get details
      await assert.rejects(async () => {
        await getUseCase.execute(otherAgentPrincipal, 'target-usecase', tenantId);
      }, /only access your own sales targets/);

      // Update to active status
      const updated = await updateUseCase.execute(adminPrincipal, {
        id: 'target-usecase',
        tenantId,
        status: 'ACTIVE',
        version: 0,
      });
      assert.strictEqual(updated.status, 'ACTIVE');

      // Optimistic concurrency locking check
      await assert.rejects(async () => {
        await updateUseCase.execute(adminPrincipal, {
          id: 'target-usecase',
          tenantId,
          targetAmount: 2500,
          version: 0, // Old version
        });
      }, /Optimistic locking conflict/);

      // List targets
      const listRes = await listUseCase.execute(agentPrincipal, tenantId, {});
      assert.strictEqual(listRes.items.length, 1);
      assert.strictEqual(listRes.items[0].id, 'target-usecase');
    });
  });

  describe('4. Event Consumer projection logic', () => {
    test('Should progressively update active sales target achievedAmount from order.placed event', async () => {
      const repo = new SalesTargetPgRepository();
      
      // Seed active target
      const target = SalesTarget.create({
        id: 'target-consumer-test',
        tenantId,
        agentId,
        periodMonth: 7,
        periodYear: 2026,
        targetAmount: Money.fromCents(100000), // 1000.00
        targetType: 'volume',
      });
      target.activate();
      await repo.save(target, tenantId);

      const dbMock: any = {
        transaction: async (cb: any, tId: string) => {
          await cb(undefined);
        },
      };

      const brokerMock: any = {
        subscribe: () => {},
      };

      const consumer = new OrderPlacedSalesTargetConsumer(dbMock, brokerMock);

      const event: InboundEvent<any> = {
        eventId: 'evt-order-placed-1',
        eventType: 'order.placed.v1',
        tenantId,
        payload: {
          agentId,
          totalAmount: 250.50,
          currency: 'INR',
          timestamp: '2026-07-15T10:00:00Z',
        },
      };

      // Handle placement
      await (consumer as any).handleEvent(event);

      const found = await repo.findById('target-consumer-test', tenantId);
      assert.ok(found);
      assert.strictEqual(found.achievedAmount.amount, 250.50);
      assert.strictEqual(found.status, 'ACTIVE');

      // Send another order completing the target (exceeds 1000)
      const event2: InboundEvent<any> = {
        eventId: 'evt-order-placed-2',
        eventType: 'order.placed.v1',
        tenantId,
        payload: {
          agentId,
          totalAmount: 800.00,
          currency: 'INR',
          timestamp: '2026-07-15T11:00:00Z',
        },
      };

      await (consumer as any).handleEvent(event2);

      const completedTarget = await repo.findById('target-consumer-test', tenantId);
      assert.ok(completedTarget);
      assert.strictEqual(completedTarget.achievedAmount.amount, 1050.50);
      assert.strictEqual(completedTarget.status, 'COMPLETED');
    });
  });
});
