import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { VanSale } from './domain/entities/van-sale.js';
import { Money } from './domain/value-objects/money.js';
import { VanSalePgRepository } from './infrastructure/database/repositories/van-sale.pg-repository.js';
import { CreateVanSaleUseCase } from './application/usecases/van-sale/create-van-sale.usecase.js';
import { GetVanSaleUseCase } from './application/usecases/van-sale/get-van-sale.usecase.js';
import { UpdateVanSaleUseCase } from './application/usecases/van-sale/update-van-sale.usecase.js';
import { ListVanSalesUseCase } from './application/usecases/van-sale/list-van-sales.usecase.js';
import { VanSaleController } from './presentation/rest/controllers/van-sale.controller.js';
import { Principal } from '@dms/pkg-rbac';
import { AuditController } from '../../../services/audit-service/src/presentation/rest/controllers/audit.controller.js';

describe('SFA VanSale Slice Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const otherTenantId = '00000000-0000-0000-0000-000000000002';
  const id = '00000000-0000-0000-0000-000000000123';
  const agentId = '00000000-0000-0000-0000-000000000444';
  const vehicleId = '00000000-0000-0000-0000-000000000999';
  const routeId = '00000000-0000-0000-0000-000000000111';

  const agentPrincipal: Principal = {
    id: 'agent-123',
    tenantId,
    roles: ['agent'],
  };

  const adminPrincipal: Principal = {
    id: 'admin-999',
    tenantId,
    roles: ['admin'],
  };

  const unauthorizedPrincipal: Principal = {
    id: 'agent-other',
    tenantId: otherTenantId,
    roles: ['agent'],
  };

  beforeEach(() => {
    VanSaleController.clearStore();
  });

  describe('1. Domain Entity aggregate', () => {
    test('Should create and reconstitute VanSale aggregate and enforce invariants', () => {
      const van = VanSale.create({
        id,
        tenantId,
        agentId,
        vehicleId,
        routeId,
        date: '2026-06-20',
        loadedItems: [
          { skuId: 'sku-1', qty: 10, batchNumber: 'BAT-1' }
        ]
      });

      assert.strictEqual(van.id, id);
      assert.strictEqual(van.status, 'loading');
      assert.strictEqual(van.loadedItems.length, 1);

      // Transitions check
      van.startTransit();
      assert.strictEqual(van.status, 'in_transit');

      van.startSelling();
      assert.strictEqual(van.status, 'selling');

      // Record spot sale
      van.recordSale({
        skuId: 'sku-1',
        qty: 4,
        unitPrice: 100,
        outletId: 'out-1'
      });
      assert.strictEqual(van.soldItems.length, 1);

      // Rule: sold + returned <= loaded per SKU
      assert.throws(() => {
        van.recordSale({
          skuId: 'sku-1',
          qty: 7, // 4 + 7 = 11 > 10 loaded
          unitPrice: 100,
          outletId: 'out-1'
        });
      }, /Cannot sold/);

      van.recordReturn({
        skuId: 'sku-1',
        qty: 6, // 4 + 6 = 10
        reason: 'Unsold'
      });
      assert.strictEqual(van.returnedItems.length, 1);

      van.startReconciliation();
      assert.strictEqual(van.status, 'reconciliation');

      van.collectCash(Money.of(4.00, 'INR'));
      assert.strictEqual(van.cashCollected.amount, 4.00);

      van.close();
      assert.strictEqual(van.status, 'closed');
    });
  });

  describe('2. Postgres Repository implementation', () => {
    test('Should save, find, and delete van sales from repository', async () => {
      const repo = new VanSalePgRepository();
      const van = VanSale.create({
        id,
        tenantId,
        agentId,
        vehicleId,
        routeId,
        date: '2026-06-20',
        loadedItems: [{ skuId: 'sku-1', qty: 5, batchNumber: 'B1' }]
      });

      await repo.save(van);

      const found = await repo.findById(id, tenantId);
      assert.ok(found);
      assert.strictEqual(found.agentId, agentId);

      const all = await repo.findAll(tenantId);
      assert.strictEqual(all.length, 1);

      await repo.delete(id, tenantId);
      const afterDelete = await repo.findById(id, tenantId);
      assert.strictEqual(afterDelete, null);
    });
  });

  describe('3. CRUD Use Cases execution', () => {
    test('Should execute Create, Get, Update, and List Use Cases with RBAC', async () => {
      const repo = new VanSalePgRepository();
      const createUseCase = new CreateVanSaleUseCase(undefined, repo);
      const getUseCase = new GetVanSaleUseCase(undefined, repo);
      const updateUseCase = new UpdateVanSaleUseCase(undefined, repo);
      const listUseCase = new ListVanSalesUseCase(undefined, repo);

      // Create
      const resCreate = await createUseCase.execute(agentPrincipal, tenantId, {
        id,
        agentId,
        vehicleId,
        routeId,
        date: '2026-06-20',
        loadedItems: [{ skuId: 'sku-1', qty: 10, batchNumber: 'B1' }]
      });
      assert.strictEqual(resCreate.vanSaleId, id);

      // Duplicate pre-conditions validation check (one session per agent per date)
      await assert.rejects(
        createUseCase.execute(agentPrincipal, tenantId, {
          agentId,
          vehicleId,
          routeId,
          date: '2026-06-20',
          loadedItems: []
        }),
        /already has a van sale session active/
      );

      // Get
      const van = await getUseCase.execute(agentPrincipal, id, tenantId);
      assert.strictEqual(van.vehicleId, vehicleId);

      // Update (transit state, allowed for agent)
      const updated = await updateUseCase.execute(agentPrincipal, id, tenantId, {
        status: 'in_transit',
        version: 0,
      });
      assert.strictEqual(updated.status, 'in_transit');
      assert.strictEqual(updated.version, 1);

      // Concurrency lock check
      await assert.rejects(
        updateUseCase.execute(agentPrincipal, id, tenantId, {
          status: 'selling',
          version: 99,
        }),
        /Optimistic locking conflict/
      );

      // Transition to selling
      const selling = await updateUseCase.execute(agentPrincipal, id, tenantId, {
        status: 'selling',
        version: 1,
      });
      assert.strictEqual(selling.status, 'selling');
      assert.strictEqual(selling.version, 2);

      // Transition to reconciliation
      const recon = await updateUseCase.execute(agentPrincipal, id, tenantId, {
        status: 'reconciliation',
        version: 2,
      });
      assert.strictEqual(recon.status, 'reconciliation');
      assert.strictEqual(recon.version, 3);

      // Privilege Escalation check: agent trying to close/approve status
      await assert.rejects(
        updateUseCase.execute(agentPrincipal, id, tenantId, {
          status: 'closed',
          version: 3,
        }),
        /Insufficient permissions, missing van_sale:approve/
      );

      // Success: admin can close session
      const closed = await updateUseCase.execute(adminPrincipal, id, tenantId, {
        status: 'closed',
        version: 3,
      });
      assert.strictEqual(closed.status, 'closed');

      // List
      const listRes = await listUseCase.execute(agentPrincipal, tenantId, { page: 1, pageSize: 5 });
      assert.strictEqual(listRes.total, 1);
    });
  });

  describe('4. REST Controller routes mapping & auditing', () => {
    test('Should validate inputs, enforce security, and record audit log', async () => {
      const controller = new VanSaleController();
      const auditRepo = AuditController.getInstance().getRepository();
      auditRepo.clear();

      // Create
      const postRes = await controller.handlePostVanSale({
        id,
        agentId,
        vehicleId,
        routeId,
        date: '2026-06-20',
        loadedItems: [{ skuId: '00000000-0000-0000-0000-000000000888', qty: 10, batchNumber: 'B1' }]
      }, {
        'x-tenant-id': tenantId,
        'x-user-id': 'agent-123',
        'x-user-roles': 'agent',
      });

      assert.strictEqual(postRes.statusCode, 201);
      assert.strictEqual(postRes.body.success, true);

      // Verify audit event
      const blocks = await auditRepo.getAllBlocks();
      assert.ok(blocks.length > 0);
      const creationLogBlock = blocks.find((b: any) => b.data && b.data.type === 'van_sale.created');
      assert.ok(creationLogBlock);
      assert.strictEqual(creationLogBlock.data.actor, 'agent-123');

      // Get
      const getRes = await controller.handleGetVanSale(id, {
        'x-tenant-id': tenantId,
        'x-user-id': 'agent-123',
        'x-user-roles': 'agent',
      });
      assert.strictEqual(getRes.statusCode, 200);

      // Put
      const putRes = await controller.handlePutVanSale(id, {
        status: 'in_transit',
        version: 0,
      }, {
        'x-tenant-id': tenantId,
        'x-user-id': 'agent-123',
        'x-user-roles': 'agent',
      });

      assert.strictEqual(putRes.statusCode, 200);

      // Delete (forbidden for agent)
      const deleteRes = await controller.handleDeleteVanSale(id, {
        'x-tenant-id': tenantId,
        'x-user-id': 'agent-123',
        'x-user-roles': 'agent',
      });
      assert.strictEqual(deleteRes.statusCode, 403);
    });
  });
});
