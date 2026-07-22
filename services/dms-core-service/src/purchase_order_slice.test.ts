import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { PurchaseOrder } from './domain/entities/purchase_order.js';
import { PurchaseOrderPgRepository } from './infrastructure/database/repositories/purchase_order.pg-repository.js';
import { CreatePurchaseOrderUseCase } from './application/usecases/purchase_order/create-purchase-order.usecase.js';
import { GetPurchaseOrderUseCase } from './application/usecases/purchase_order/get-purchase-order.usecase.js';
import { UpdatePurchaseOrderUseCase } from './application/usecases/purchase_order/update-purchase-order.usecase.js';
import { ListPurchaseOrdersUseCase } from './application/usecases/purchase_order/list-purchase-orders.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('PurchaseOrder Full Vertical Slice Unit & Repo Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const principal: Principal = {
    id: 'admin-user-1',
    tenantId,
    roles: ['admin'],
  };

  const mockDb: any = {
    query: async () => ({ rows: [] }),
  };

  beforeEach(() => {
    PurchaseOrderPgRepository.clearStore();
  });

  describe('PurchaseOrder Domain Aggregate Invariants', () => {
    test('validates totalAmountCents guard clause and state machine transitions', () => {
      // Negative amount guard clause
      assert.throws(
        () => new PurchaseOrder({
          id: randomUUID(),
          tenantId,
          poNumber: 'PO-001',
          supplierId: 'supplier-01',
          warehouseId: 'wh-01',
          totalAmountCents: -500,
        }),
        /totalAmountCents cannot be negative/
      );

      const po = PurchaseOrder.create({
        id: randomUUID(),
        tenantId,
        poNumber: 'PO-002',
        supplierId: 'supplier-02',
        warehouseId: 'wh-main',
        totalAmountCents: 50000,
      });

      assert.strictEqual(po.status, 'DRAFT');

      // Valid state transition: DRAFT -> SUBMITTED -> APPROVED -> RECEIVED
      po.updateStatus('SUBMITTED');
      assert.strictEqual(po.status, 'SUBMITTED');

      po.updateStatus('APPROVED');
      assert.strictEqual(po.status, 'APPROVED');

      po.updateStatus('RECEIVED');
      assert.strictEqual(po.status, 'RECEIVED');

      // Illegal transition after RECEIVED
      assert.throws(
        () => po.updateStatus('CANCELLED'),
        /Cannot transition from final status/
      );
    });
  });

  describe('PurchaseOrder Use Cases & Repository', () => {
    test('executes Create with idempotency key and enforces unique poNumber per tenant', async () => {
      const repo = new PurchaseOrderPgRepository(mockDb);
      const createUseCase = new CreatePurchaseOrderUseCase(repo);
      const getUseCase = new GetPurchaseOrderUseCase(repo);
      const updateUseCase = new UpdatePurchaseOrderUseCase(repo);
      const listUseCase = new ListPurchaseOrdersUseCase(repo);

      const dto = {
        poNumber: 'PO-2026-X',
        supplierId: 'sup-101',
        warehouseId: 'wh-main',
        totalAmountCents: 75000,
      };

      // Create initial
      const p1 = await createUseCase.execute(principal, dto, 'key-po-101');
      assert.strictEqual(p1.poNumber, 'PO-2026-X');

      // Idempotent retry
      const p2 = await createUseCase.execute(principal, dto, 'key-po-101');
      assert.strictEqual(p2.id, p1.id);

      // Duplicate record error
      await assert.rejects(
        () => createUseCase.execute(principal, dto),
        /Purchase order with number PO-2026-X already exists/
      );

      // Get
      const fetched = await getUseCase.execute(principal, p1.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.supplierId, 'sup-101');

      // List
      const list = await listUseCase.execute(principal, { supplierId: 'sup-101' });
      assert.strictEqual(list.total, 1);

      // Update status
      const updated = await updateUseCase.execute(principal, p1.id, {
        status: 'SUBMITTED',
        version: 1,
      });
      assert.strictEqual(updated.status, 'SUBMITTED');
      assert.strictEqual(updated.version, 2);
    });
  });
});
