import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { PrimarySale } from './domain/entities/primary_sale.js';
import { PrimarySalePgRepository } from './infrastructure/database/repositories/primary_sale.pg-repository.js';
import { CreatePrimarySaleUseCase } from './application/usecases/primary_sale/create-primary-sale.usecase.js';
import { GetPrimarySaleUseCase } from './application/usecases/primary_sale/get-primary-sale.usecase.js';
import { UpdatePrimarySaleUseCase } from './application/usecases/primary_sale/update-primary-sale.usecase.js';
import { ListPrimarySalesUseCase } from './application/usecases/primary_sale/list-primary-sales.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('PrimarySale Full Vertical Slice Unit & Repo Tests', () => {
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
    PrimarySalePgRepository.clearStore();
  });

  describe('PrimarySale Domain Aggregate Invariants', () => {
    test('validates quantity, unitPriceCents, and state machine transitions', () => {
      // Negative quantity guard clause
      assert.throws(
        () => new PrimarySale({
          id: randomUUID(),
          tenantId,
          invoiceNumber: 'INV-001',
          distributorId: 'dist-01',
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
        () => new PrimarySale({
          id: randomUUID(),
          tenantId,
          invoiceNumber: 'INV-002',
          distributorId: 'dist-01',
          warehouseId: 'wh-01',
          skuId: 'sku-01',
          quantity: 10,
          unitPriceCents: -100,
          totalAmountCents: 1000,
        }),
        /unitPriceCents and totalAmountCents cannot be negative/
      );

      const sale = PrimarySale.create({
        id: randomUUID(),
        tenantId,
        invoiceNumber: 'INV-2026-X',
        distributorId: 'dist-101',
        warehouseId: 'wh-main',
        skuId: 'sku-main-1',
        quantity: 50,
        unitPriceCents: 2000,
        totalAmountCents: 100000,
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

  describe('PrimarySale Use Cases & Repository', () => {
    test('executes Create with idempotency key and enforces unique invoiceNumber per tenant', async () => {
      const repo = new PrimarySalePgRepository(mockDb);
      const createUseCase = new CreatePrimarySaleUseCase(repo);
      const getUseCase = new GetPrimarySaleUseCase(repo);
      const updateUseCase = new UpdatePrimarySaleUseCase(repo);
      const listUseCase = new ListPrimarySalesUseCase(repo);

      const dto = {
        invoiceNumber: 'INV-2026-FULL',
        distributorId: 'dist-200',
        warehouseId: 'wh-main',
        skuId: 'sku-item-2',
        quantity: 100,
        unitPriceCents: 1500,
        totalAmountCents: 150000,
      };

      // Create initial
      const s1 = await createUseCase.execute(principal, dto, 'key-ps-101');
      assert.strictEqual(s1.invoiceNumber, 'INV-2026-FULL');

      // Idempotent retry
      const s2 = await createUseCase.execute(principal, dto, 'key-ps-101');
      assert.strictEqual(s2.id, s1.id);

      // Duplicate record error
      await assert.rejects(
        () => createUseCase.execute(principal, dto),
        /Primary sale with invoice number INV-2026-FULL already exists/
      );

      // Get
      const fetched = await getUseCase.execute(principal, s1.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.distributorId, 'dist-200');

      // List
      const list = await listUseCase.execute(principal, { distributorId: 'dist-200' });
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
