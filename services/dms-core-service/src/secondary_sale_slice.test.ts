import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { SecondarySale } from './domain/entities/secondary_sale.js';
import { SecondarySalePgRepository } from './infrastructure/database/repositories/secondary_sale.pg-repository.js';
import { CreateSecondarySaleUseCase } from './application/usecases/secondary_sale/create-secondary-sale.usecase.js';
import { GetSecondarySaleUseCase } from './application/usecases/secondary_sale/get-secondary-sale.usecase.js';
import { UpdateSecondarySaleUseCase } from './application/usecases/secondary_sale/update-secondary-sale.usecase.js';
import { ListSecondarySalesUseCase } from './application/usecases/secondary_sale/list-secondary-sales.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('SecondarySale Full Vertical Slice Unit & Repo Tests', () => {
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
    SecondarySalePgRepository.clearStore();
  });

  describe('SecondarySale Domain Aggregate Invariants', () => {
    test('validates quantity, unitPriceCents, and state machine transitions', () => {
      // Negative quantity guard clause
      assert.throws(
        () => new SecondarySale({
          id: randomUUID(),
          tenantId,
          invoiceNumber: 'INV-SEC-001',
          outletId: 'outlet-01',
          warehouseId: 'wh-01',
          skuId: 'sku-01',
          quantity: -5,
          unitPriceCents: 1000,
          totalAmountCents: 5000,
        }),
        /quantity must be positive/
      );

      // Negative pricing guard clause
      assert.throws(
        () => new SecondarySale({
          id: randomUUID(),
          tenantId,
          invoiceNumber: 'INV-SEC-002',
          outletId: 'outlet-01',
          warehouseId: 'wh-01',
          skuId: 'sku-01',
          quantity: 10,
          unitPriceCents: -100,
          totalAmountCents: 1000,
        }),
        /unitPriceCents and totalAmountCents cannot be negative/
      );

      const sale = SecondarySale.create({
        id: randomUUID(),
        tenantId,
        invoiceNumber: 'INV-SEC-2026-X',
        outletId: 'outlet-101',
        warehouseId: 'wh-main',
        skuId: 'sku-main-1',
        quantity: 20,
        unitPriceCents: 1200,
        totalAmountCents: 24000,
      });

      assert.strictEqual(sale.status, 'DRAFT');

      // Valid state transition: DRAFT -> SUBMITTED -> CONFIRMED -> DISPATCHED -> DELIVERED
      sale.updateStatus('SUBMITTED');
      assert.strictEqual(sale.status, 'SUBMITTED');

      sale.updateStatus('CONFIRMED');
      assert.strictEqual(sale.status, 'CONFIRMED');

      sale.updateStatus('DISPATCHED');
      assert.strictEqual(sale.status, 'DISPATCHED');

      sale.updateStatus('DELIVERED');
      assert.strictEqual(sale.status, 'DELIVERED');

      // Illegal transition after DELIVERED
      assert.throws(
        () => sale.updateStatus('CANCELLED'),
        /Cannot transition from final status/
      );
    });
  });

  describe('SecondarySale Use Cases & Repository', () => {
    test('executes Create with idempotency key and enforces unique invoiceNumber per tenant', async () => {
      const repo = new SecondarySalePgRepository(mockDb);
      const createUseCase = new CreateSecondarySaleUseCase(repo);
      const getUseCase = new GetSecondarySaleUseCase(repo);
      const updateUseCase = new UpdateSecondarySaleUseCase(repo);
      const listUseCase = new ListSecondarySalesUseCase(repo);

      const dto = {
        invoiceNumber: 'INV-SEC-2026-FULL',
        outletId: 'outlet-200',
        warehouseId: 'wh-main',
        skuId: 'sku-item-2',
        quantity: 15,
        unitPriceCents: 2000,
        totalAmountCents: 30000,
      };

      // Create initial
      const s1 = await createUseCase.execute(principal, dto, 'key-sec-101');
      assert.strictEqual(s1.invoiceNumber, 'INV-SEC-2026-FULL');

      // Idempotent retry
      const s2 = await createUseCase.execute(principal, dto, 'key-sec-101');
      assert.strictEqual(s2.id, s1.id);

      // Duplicate record error
      await assert.rejects(
        () => createUseCase.execute(principal, dto),
        /Secondary sale with invoice number INV-SEC-2026-FULL already exists/
      );

      // Get
      const fetched = await getUseCase.execute(principal, s1.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.outletId, 'outlet-200');

      // List
      const list = await listUseCase.execute(principal, { outletId: 'outlet-200' });
      assert.strictEqual(list.total, 1);

      // Update status
      const updated = await updateUseCase.execute(principal, s1.id, {
        status: 'SUBMITTED',
        version: 1,
      });
      assert.strictEqual(updated.status, 'SUBMITTED');
      assert.strictEqual(updated.version, 2);
    });
  });
});
