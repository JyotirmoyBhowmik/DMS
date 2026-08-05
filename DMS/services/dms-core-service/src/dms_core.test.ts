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

  test('DMS EventConsumer should process event once and skip duplicates', async () => {
    const { EventConsumer } = await import('./presentation/events/event_consumer.js');
    EventConsumer.clearStore();
    const consumer = new EventConsumer();

    const envelope = {
      eventId: 'evt-inventory-adjusted-dedupe-1',
      eventType: 'inventory.adjusted',
      tenantId: 'tenant-uuid-1111',
      data: { skuId: 'sku-A', adjustment: 10 }
    };

    let processedCount = 0;
    const handler = async (evt: any) => {
      processedCount++;
      assert.strictEqual(evt.data.skuId, 'sku-A');
    };

    // First ingestion should process
    const result1 = await consumer.consume(envelope as any, handler);
    assert.strictEqual(result1.status, 'processed');
    assert.strictEqual(processedCount, 1);

    // Second ingestion (duplicate eventId) should skip
    const result2 = await consumer.consume(envelope as any, handler);
    assert.strictEqual(result2.status, 'skipped');
    assert.strictEqual(processedCount, 1); // Callback not triggered again
  });

  test('Enterprise DMS Controller and Use Cases Integration', async () => {
    const { EnterpriseDmsController } = await import('./presentation/rest/controllers/enterprise_dms.controller.js');
    const ctrl = new EnterpriseDmsController();
    const headers = { 'x-tenant-id': tenantId };

    // 1. DistributorHierarchy
    const hRes = await ctrl.handleCreateHierarchy({
      id: 'h-1',
      parentDistributorId: 'parent-1',
      childDistributorId: 'child-1',
      hierarchyLevel: 'DISTRIBUTOR',
      territory: 'North Delhi',
      effectiveFrom: '2026-06-01',
      effectiveTo: '2027-06-01'
    }, headers);
    assert.strictEqual(hRes.status, 201);
    assert.strictEqual((hRes.body.hierarchy as any).hierarchyLevel, 'DISTRIBUTOR');

    // 2. KYCDocument upload & verify
    const kycRes = await ctrl.handleUploadKYCDocument({
      id: 'kyc-1',
      distributorId: 'dist-1',
      documentType: 'GSTIN',
      documentNumber: '07AAAAA1111A1Z1',
      documentUrl: 'http://docs.com/gstin.pdf',
      expiresAt: '2030-06-01'
    }, headers);
    assert.strictEqual(kycRes.status, 201);
    assert.strictEqual((kycRes.body.document as any).verificationStatus, 'PENDING');

    const verifyRes = await ctrl.handleVerifyKYCDocument({
      id: 'kyc-1',
      verifiedBy: 'verifier-1',
      approve: true
    }, headers);
    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual((verifyRes.body.document as any).verificationStatus, 'VERIFIED');

    // 3. CreditLimit
    const clRes = await ctrl.handleCreateCreditLimit({
      id: 'cl-1',
      distributorId: 'dist-1',
      creditLimit: 5000000,
      creditRating: 'A',
      paymentTermDays: 45
    }, headers);
    assert.strictEqual(clRes.status, 201);
    assert.strictEqual((clRes.body.creditLimit as any).creditRating, 'A');

    const utilRes = await ctrl.handleUtilizeCredit({
      id: 'cl-1',
      amount: 1000000
    }, headers);
    assert.strictEqual(utilRes.status, 200);
    assert.strictEqual((utilRes.body.creditLimit as any).utilizedAmount, 1000000);

    // 4. StockLedgerEntry
    const ledgerRes = await ctrl.handleRecordLedgerEntry({
      id: 'ledger-1',
      productId: 'prod-1',
      warehouseId: 'wh-1',
      batchNumber: 'B1',
      transactionType: 'INWARD',
      quantity: 500,
      runningBalance: 500,
      referenceId: 'ref-1',
      referenceType: 'MANUAL',
      createdBy: 'user-1'
    }, headers);
    assert.strictEqual(ledgerRes.status, 201);
    
    const getLedgerRes = await ctrl.handleGetLedger('prod-1', headers);
    assert.strictEqual(getLedgerRes.status, 200);
    assert.strictEqual((getLedgerRes.body as any).items.length, 1);

    // 5. StockTransfer
    const txReqRes = await ctrl.handleRequestTransfer({
      id: 'tx-1',
      fromWarehouseId: 'wh-1',
      toWarehouseId: 'wh-2',
      items: [{ productId: 'prod-1', batchNumber: 'B1', quantity: 50, expiryDate: '2027-06-01' }],
      requestedBy: 'user-1'
    }, headers);
    assert.strictEqual(txReqRes.status, 201);
    assert.strictEqual((txReqRes.body.transfer as any).status, 'REQUESTED');

    const txAppRes = await ctrl.handleApproveTransfer({
      id: 'tx-1',
      approvedBy: 'approver-1'
    }, headers);
    assert.strictEqual(txAppRes.status, 200);
    assert.strictEqual((txAppRes.body.transfer as any).status, 'APPROVED');

    const txShipRes = await ctrl.handleShipTransfer({
      id: 'tx-1'
    }, headers);
    assert.strictEqual(txShipRes.status, 200);
    assert.strictEqual((txShipRes.body.transfer as any).status, 'IN_TRANSIT');

    const txRecRes = await ctrl.handleReceiveTransfer({
      id: 'tx-1',
      receivedBy: 'receiver-1'
    }, headers);
    assert.strictEqual(txRecRes.status, 200);
    assert.strictEqual((txRecRes.body.transfer as any).status, 'CLOSED');

    // 6. ProductCategory
    const catRes = await ctrl.handleCreateCategory({
      id: 'cat-1',
      name: 'Beverages',
      level: 1,
      sortOrder: 1
    }, headers);
    assert.strictEqual(catRes.status, 201);
    assert.strictEqual((catRes.body.category as any).name, 'Beverages');

    // 7. Batch
    const batchRes = await ctrl.handleCreateBatch({
      id: 'batch-1',
      productId: 'prod-1',
      batchNumber: 'B1',
      manufacturingDate: '2026-06-01',
      expiryDate: '2027-06-01',
      quantity: 1000
    }, headers);
    assert.strictEqual(batchRes.status, 201);
    assert.strictEqual((batchRes.body.batch as any).batchNumber, 'B1');

    // 8. Invoice generate & issue (raises eInvoice & eWayBill)
    const invRes = await ctrl.handleGenerateInvoice({
      id: 'inv-1',
      distributorId: 'dist-1',
      orderId: 'ord-1',
      invoiceNumber: 'INV-001',
      items: [{
        productId: 'prod-1',
        quantity: 10,
        unitPrice: 10000,
        discountAmount: 1000,
        taxableAmount: 90000,
        taxRatePct: 18,
        taxAmount: 16200,
        totalAmount: 106200
      }],
      dueDate: '2026-07-01'
    }, headers);
    assert.strictEqual(invRes.status, 201);
    assert.strictEqual((invRes.body.invoice as any).netAmount, 106200);

    const issueRes = await ctrl.handleIssueInvoice({
      id: 'inv-1'
    }, headers);
    assert.strictEqual(issueRes.status, 200);
    assert.strictEqual((issueRes.body.invoice as any).status, 'ISSUED');
    assert.ok((issueRes.body.invoice as any).eInvoiceIrn);
    assert.ok((issueRes.body.invoice as any).eWayBillNumber);
  });
});

