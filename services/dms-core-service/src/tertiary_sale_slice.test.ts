import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { TertiarySale } from './domain/entities/tertiary_sale.js';
import { TertiarySalePgRepository } from './infrastructure/database/repositories/tertiary_sale.pg-repository.js';
import { CreateTertiarySaleUseCase } from './application/usecases/tertiary_sale/create-tertiary-sale.usecase.js';
import { GetTertiarySaleUseCase } from './application/usecases/tertiary_sale/get-tertiary-sale.usecase.js';
import { UpdateTertiarySaleUseCase } from './application/usecases/tertiary_sale/update-tertiary-sale.usecase.js';
import { ListTertiarySalesUseCase } from './application/usecases/tertiary_sale/list-tertiary-sales.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('TertiarySale Full Vertical Slice Unit & Repo Tests', () => {
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
    TertiarySalePgRepository.clearStore();
  });

  describe('TertiarySale Domain Aggregate Invariants', () => {
    test('validates quantity, unitPriceCents, and state machine transitions', () => {
      // Negative quantity guard clause
      assert.throws(
        () => new TertiarySale({
          id: randomUUID(),
          tenantId,
          invoiceNumber: 'INV-TER-001',
          consumerId: 'consumer-01',
          outletId: 'outlet-01',
          skuId: 'sku-01',
          quantity: -5,
          unitPriceCents: 1000,
          totalAmountCents: 5000,
        }),
        /quantity must be positive/
      );

      // Negative pricing guard clause
      assert.throws(
        () => new TertiarySale({
          id: randomUUID(),
          tenantId,
          invoiceNumber: 'INV-TER-002',
          consumerId: 'consumer-01',
          outletId: 'outlet-01',
          skuId: 'sku-01',
          quantity: 10,
          unitPriceCents: -100,
          totalAmountCents: 1000,
        }),
        /unitPriceCents and totalAmountCents cannot be negative/
      );

      const sale = TertiarySale.create({
        id: randomUUID(),
        tenantId,
        invoiceNumber: 'INV-TER-2026-X',
        consumerId: 'consumer-101',
        outletId: 'outlet-main',
        skuId: 'sku-main-1',
        quantity: 5,
        unitPriceCents: 2500,
        totalAmountCents: 12500,
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

  describe('TertiarySale Use Cases & Repository', () => {
    test('executes Create with idempotency key and enforces unique invoiceNumber per tenant', async () => {
      const repo = new TertiarySalePgRepository(mockDb);
      const createUseCase = new CreateTertiarySaleUseCase(repo);
      const getUseCase = new GetTertiarySaleUseCase(repo);
      const updateUseCase = new UpdateTertiarySaleUseCase(repo);
      const listUseCase = new ListTertiarySalesUseCase(repo);

      const dto = {
        invoiceNumber: 'INV-TER-2026-FULL',
        consumerId: 'consumer-200',
        outletId: 'outlet-main',
        skuId: 'sku-item-2',
        quantity: 2,
        unitPriceCents: 3000,
        totalAmountCents: 6000,
      };

      // Create initial
      const s1 = await createUseCase.execute(principal, dto, 'key-ter-101');
      assert.strictEqual(s1.invoiceNumber, 'INV-TER-2026-FULL');

      // Idempotent retry
      const s2 = await createUseCase.execute(principal, dto, 'key-ter-101');
      assert.strictEqual(s2.id, s1.id);

      // Duplicate record error
      await assert.rejects(
        () => createUseCase.execute(principal, dto),
        /Tertiary sale with invoice number INV-TER-2026-FULL already exists/
      );

      // Get
      const fetched = await getUseCase.execute(principal, s1.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.consumerId, 'consumer-200');

      // List
      const list = await listUseCase.execute(principal, { consumerId: 'consumer-200' });
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
