import { test, describe } from 'node:test';
import assert from 'node:assert';
import { InventoryAggregate } from './domain/entities/inventory_aggregate.js';
import { ClaimAggregate } from './domain/entities/claim_aggregate.js';
import { PricingPolicy } from './domain/policies/pricing_policy.js';
import { DmsController } from './presentation/rest/controllers/dms.controller.js';

describe('DMS Core Aggregates & Policies Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const productId = 'prod-1001';
  const warehouseId = 'wh-001';

  test('InventoryAggregate adjust, reserve, release and expiry logic', () => {
    const inv = new InventoryAggregate('inv-1001', tenantId, productId, warehouseId);

    // 1. Initial adjustments (valid unexpired batches)
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    inv.adjustStock('batch-A', 100, tomorrow);
    assert.strictEqual(inv.totalStock, 100);

    // 2. Adjusting negative/deduction
    inv.adjustStock('batch-A', -20, tomorrow);
    assert.strictEqual(inv.totalStock, 80);

    // 3. Add expired batch (must not count towards totalStock)
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    inv.adjustStock('batch-expired', 50, yesterday);
    assert.strictEqual(inv.totalStock, 80); // expired stock is omitted

    // 4. Reserve stock from unexpired batch
    inv.reserveStock('res-1', 'batch-A', 30);
    assert.strictEqual(inv.totalStock, 50); // 80 - 30 reserved = 50

    // 5. Release reservation
    inv.releaseReservation('res-1');
    assert.strictEqual(inv.totalStock, 80); // returns to 80

    // 6. Confirm reservation
    inv.reserveStock('res-2', 'batch-A', 40);
    inv.confirmReservation('res-2');
    assert.strictEqual(inv.totalStock, 40); // 40 units consumed
  });

  test('ClaimAggregate accrue, validate and settle state machine', () => {
    const claim = new ClaimAggregate('claim-1001', tenantId, 'dist-2002');
    
    assert.strictEqual(claim.getState(), 'DRAFT');

    // 1. Accrue details
    claim.accrue('SCHEME_DISCOUNT', 10000, 'Discount reward');
    claim.accrue('DAMAGED_GOODS', 5000, 'Broken bottles');
    assert.strictEqual(claim.getTotalAmount(), 15000);

    // 2. Submit
    claim.submit();
    assert.strictEqual(claim.getState(), 'SUBMITTED');

    // 3. Validate (within tolerance, e.g. claimed = 15000, system calculated = 14500, tolerance = 5%)
    // Diff is 500. Max allowed is 5% of 14500 = 725.
    claim.validate(14500, 5.0);
    assert.strictEqual(claim.getState(), 'VALIDATED');

    // 4. Settle
    claim.settle('REF-PAY-999');
    assert.strictEqual(claim.getState(), 'SETTLED');
    assert.strictEqual(claim.getSettlementRef(), 'REF-PAY-999');
  });

  test('PricingPolicy list price, quantity breaks, and tax calculations', () => {
    const listPrice = 1000; // e.g. $10.00 in cents

    // Case A: Qty = 5 (No quantity break discount, GST 18%)
    const pricingA = PricingPolicy.calculate(listPrice, 5, 'GST_18');
    assert.strictEqual(pricingA.discountedUnitPrice, listPrice);
    assert.strictEqual(pricingA.subtotal, 5000);
    assert.strictEqual(pricingA.discountAmount, 0);
    assert.strictEqual(pricingA.taxAmount, 900); // 18% of 5000 = 900
    assert.strictEqual(pricingA.totalAmount, 5900);

    // Case B: Qty = 25 (2% discount tier, GST 12%)
    const pricingB = PricingPolicy.calculate(listPrice, 25, 'GST_12');
    assert.strictEqual(pricingB.discountedUnitPrice, 980); // 2% of 1000 is 20 discount
    assert.strictEqual(pricingB.subtotal, 24500); // 980 * 25
    assert.strictEqual(pricingB.discountAmount, 500); // 20 * 25
    assert.strictEqual(pricingB.taxAmount, 2940); // 12% of 24500
  });

  test('DmsController endpoints integration', async () => {
    DmsController.clearStore();
    const controller = new DmsController();
    const claimId = 'claim-test-123';

    // 1. Create/Accrue claim
    const cRes = await controller.handlePostClaim({
      id: claimId,
      tenantId,
      distributorId: 'dist-1',
      items: [{ category: 'RETURNS', amount: 5000 }]
    });
    assert.strictEqual(cRes.status, 201);
    assert.strictEqual(cRes.body.state, 'SUBMITTED');

    // 2. Validate claim (claimed=5000, system=5200, diff=200, tolerance=5% of 5200 = 260) -> VALIDATED
    const vRes = await controller.handleValidateClaim({
      claimId,
      systemCalculatedAmount: 5200,
      tolerancePct: 5.0
    });
    assert.strictEqual(vRes.status, 200);
    assert.strictEqual(vRes.body.state, 'VALIDATED');

    // 3. Settle claim
    const sRes = await controller.handleSettleClaim({
      claimId,
      paymentRef: 'PAY-INTEG-11'
    });
    assert.strictEqual(sRes.status, 200);
    assert.strictEqual(sRes.body.state, 'SETTLED');

    // 4. Returns processing
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const rRes = await controller.handlePostReturn({
      tenantId,
      distributorId: 'dist-1',
      productId: 'prod-A',
      quantity: 10,
      batchNumber: 'batch-ret-11',
      expiryDate: tomorrow,
      reason: 'Damaged packaging'
    });
    assert.strictEqual(rRes.status, 200);
    assert.ok(rRes.body.success);
    assert.ok(rRes.body.refundClaimId);

    // 5. Price-list pricing request
    const pRes = await controller.handleGetPriceList({
      listPrice: 5000,
      quantity: 50, // 5% discount
      taxRuleKey: 'GST_18'
    });
    assert.strictEqual(pRes.status, 200);
    assert.strictEqual(pRes.body.discountedUnitPrice, 4750); // 5000 * 0.95
  });
});
