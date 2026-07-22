import { test, describe } from 'node:test';
import assert from 'node:assert';
import { PrimarySale } from './domain/entities/primary_sale.js';
import { randomUUID } from 'node:crypto';

describe('PrimarySale Core Domain & Aggregate Invariants', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';

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
