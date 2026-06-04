import { test, describe } from 'node:test';
import assert from 'node:assert';
import { OrderAggregate } from './domain/aggregates/order.aggregate.js';
import { OrderEntity } from './domain/entities/order.entity.js';
import { SchemePolicy } from './domain/policies/scheme_policy.js';
import { JourneyPolicy } from './domain/policies/journey_policy.js';
import { ProcessOrderUseCase } from './application/usecases/process_order.usecase.js';
import { CompleteVisitUseCase } from './application/usecases/complete_visit.usecase.js';
import { OrderController } from './presentation/rest/controllers/order.controller.js';
import { VisitController } from './presentation/rest/controllers/visit.controller.js';
import { JourneyPlanController } from './presentation/rest/controllers/journey_plan.controller.js';
import { Visit } from './domain/entities/visit.js';
import { Order } from './domain/entities/order.js';
import { Money } from './domain/value-objects/money.js';
import { OrderLine } from './domain/value-objects/order-line.js';
import { GeoPoint } from './domain/value-objects/geo-point.js';

describe('SFA Sales Force Automation Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const outletId = 'outlet-1111';

  test('OrderAggregate state machine and recomputeTotals with tax GST formulas', () => {
    const entity = new OrderEntity({
      id: 'ord-101',
      tenantId,
      outletId,
      status: 'draft',
      items: [
        { skuId: 'sku-A', quantity: 10, price: 1000 }, // Subtotal: 10,000
      ]
    });

    const aggregate = new OrderAggregate(entity);
    assert.strictEqual(entity.status, 'draft');

    // 1. Recompute totals with 18% standard GST and a 1,000 discount
    // Subtotal: 10,000. Discount: 1,000. Taxable: 9,000.
    // Tax: 18% of 9,000 = 1,620. Total: 9,000 + 1,620 = 10,620.
    aggregate.recomputeTotals(18.0, 1000);
    assert.strictEqual(entity.totalAmount, 10620);

    // 2. State transitions
    aggregate.place();
    assert.strictEqual(entity.status, 'placed');

    aggregate.confirm();
    assert.strictEqual(entity.status, 'confirmed');

    // 3. Rejects invalid cancellation
    assert.throws(() => aggregate.cancel(), /Cannot cancel/);
  });

  test('SchemePolicy slab evaluation and volume discounts', () => {
    const mockOrder = Order.create({
      id: 'ord-1',
      tenantId,
      agentId: 'agent-1',
      outletId,
      distributorId: 'dist-1',
      creditLimit: Money.of(1000000, 'INR'),
      outstandingBalance: Money.zero(),
    });

    // Subtotal = 60 * 1000 = 60,000. Matches Slab 2 (>= 50,000) which yields 5%.
    // Matches volume discount (qty 60 >= 50) which yields extra 3% (stackable).
    // Total discount = 8%.
    mockOrder.addLine(OrderLine.create('sku-A', 60, 1000));
    
    const evaluation = SchemePolicy.evaluate(mockOrder);
    assert.strictEqual(evaluation.bestSlabDiscount, 5);
    assert.strictEqual(evaluation.volumeDiscount, 3);
    assert.strictEqual(evaluation.totalDiscountPct, 8);

    const discountAmount = SchemePolicy.applyBestDiscount(mockOrder);
    assert.strictEqual(discountAmount.amount, 4800); // 8% of 60,000 = 4,800
  });

  test('JourneyPolicy coordinates beat adherence and rerouting Detours', () => {
    const DelhiCenter = { lat: 28.6139, lng: 77.2090 };
    
    // Compliant location (~11m away)
    const compliantLoc = { lat: 28.6140, lng: 77.2090 };
    assert.strictEqual(JourneyPolicy.isBeatAdherent(compliantLoc, DelhiCenter, 50), true);

    // Deviating location (~560m away)
    const deviantLoc = { lat: 28.6190, lng: 77.2090 };
    assert.strictEqual(JourneyPolicy.isBeatAdherent(deviantLoc, DelhiCenter, 50), false);

    // Reroute suggestions proximity sorting
    const unvisited = [
      { id: 'o-far', name: 'Far Outlet', location: { lat: 28.8000, lng: 77.3000 } },
      { id: 'o-near', name: 'Near Outlet', location: { lat: 28.6200, lng: 77.2100 } },
    ];

    const suggestions = JourneyPolicy.suggestReroute(DelhiCenter, unvisited);
    assert.strictEqual(suggestions[0]?.outletId, 'o-near'); // Nearest first
    assert.strictEqual(suggestions[1]?.outletId, 'o-far');
  });

  test('ProcessOrderUseCase and CompleteVisitUseCase workflow steps', async () => {
    const processUseCase = new ProcessOrderUseCase();
    const completeUseCase = new CompleteVisitUseCase();

    // 1. ProcessOrder
    const entity = new OrderEntity({
      id: 'ord-102',
      tenantId,
      outletId,
      items: [{ skuId: 'sku-A', quantity: 20, price: 1000 }] // Subtotal = 20,000
    });

    const pResult = await processUseCase.execute(entity, 1000000);
    assert.strictEqual(pResult.status, 'confirmed');
    // Subtotal = 20,000. Qty 20 yields 2% volume break discount (20000 * 0.02 = 400).
    // Taxable = 19,600. Tax = 19,600 * 0.18 = 3,528.
    // Net total = 19,600 + 3,528 = 23,128.
    assert.strictEqual(pResult.netTotal, 23128);
    assert.strictEqual(pResult.event.type, 'order.confirmed');

    // 2. CompleteVisit
    const visit = Visit.create({
      id: 'visit-99',
      tenantId,
      agentId: 'agent-1',
      outletId,
      journeyPlanId: 'jp-1',
      plannedDate: new Date(),
    });
    // Start visit
    visit.checkIn(GeoPoint.create(28.6139, 77.2090));

    const cResult = await completeUseCase.execute(
      visit,
      28.6139,
      77.2090,
      28.6139,
      77.2090
    );
    assert.strictEqual(cResult.isAdherent, true);
    assert.strictEqual(cResult.event.type, 'visit.completed');
  });

  test('OrderController and VisitController REST handlers', async () => {
    OrderController.clearStore();
    const orderCtrl = new OrderController();
    const visitCtrl = new VisitController();

    // 1. OrderController handlePostOrder & handleCancelOrder
    const oRes = await orderCtrl.handlePostOrder(
      {
        outletId: '3c0a52f4-d5d4-47c0-a7d4-8d48177dfc89',
        items: [{ skuId: 'bf9d22c9-65fe-4d7a-a682-62fe8324e93f', quantity: 5, price: 2000 }],
        notes: 'Handle with care'
      },
      { 'x-tenant-id': tenantId, 'x-agent-id': 'agent-1' }
    );
    assert.strictEqual(oRes.statusCode, 201);
    assert.strictEqual(oRes.body.status, 'confirmed');

    const cRes = await orderCtrl.handleCancelOrder(oRes.body.orderId, { 'x-tenant-id': tenantId });
    assert.strictEqual(cRes.statusCode, 200);
    assert.strictEqual(cRes.body.status, 'cancelled');

    // 2. VisitController handleCheckIn & handleCheckOut & handleSuggestReroute
    const viRes = await visitCtrl.handleCheckIn(
      'visit-1001',
      28.6140,
      77.2090,
      { 'x-tenant-id': 'tenant-uuid-1111' }
    );
    assert.strictEqual(viRes.status, 200);

    const voRes = await visitCtrl.handleCheckOut(
      'visit-1001',
      28.6140,
      77.2090,
      { 'x-tenant-id': 'tenant-uuid-1111' }
    );
    assert.strictEqual(voRes.status, 200);
    assert.strictEqual(voRes.body.isGeofenceAdherent, true);

    const vrRes = await visitCtrl.handleSuggestReroute(
      28.6139,
      77.2090,
      { 'x-tenant-id': 'tenant-uuid-1111' }
    );
    assert.strictEqual(vrRes.status, 200);
    assert.strictEqual(vrRes.body.count, 3);
  });

  test('JourneyPlanController creation and retrieval', async () => {
    JourneyPlanController.clearStore();
    const ctrl = new JourneyPlanController();
    const agentId = 'agent-uuid-5555';
    const date = '2026-06-05';
    const headers = { 'x-tenant-id': tenantId, 'x-agent-id': agentId };

    const planData = {
      date,
      beatId: '00000000-0000-0000-0000-000000000002',
      beatName: 'South Delhi Retail Beat',
      plannedOutlets: [
        {
          outletId: '00000000-0000-0000-0000-000000000003',
          outletName: 'Sagar Store CP',
          sequence: 1,
          latitude: 28.6139,
          longitude: 77.2090,
          estimatedArrival: new Date().toISOString(),
        }
      ]
    };

    // 1. Create plan
    const createRes = await ctrl.handleCreateJourneyPlan(planData, headers);
    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    assert.ok(createRes.body.planId);

    // 2. Prevent duplicate creation
    const dupRes = await ctrl.handleCreateJourneyPlan(planData, headers);
    assert.strictEqual(dupRes.statusCode, 409);

    // 3. Retrieve plan
    const getRes = await ctrl.handleGetAgentJourney(agentId, date, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual(getRes.body.success, true);
    assert.strictEqual(getRes.body.plan.agentId, agentId);
    assert.strictEqual(getRes.body.plan.beatName, 'South Delhi Retail Beat');
    assert.strictEqual(getRes.body.plan.plannedOutlets.length, 1);
  });

  test('EventConsumer should process event once and skip duplicates', async () => {
    const { EventConsumer } = await import('./presentation/events/event_consumer.js');
    EventConsumer.clearStore();
    const consumer = new EventConsumer();

    const envelope = {
      eventId: 'evt-order-placed-dedupe-1',
      eventType: 'order.placed',
      tenantId: 'tenant-uuid-1111',
      data: { orderId: 'ord-101' }
    };

    let processedCount = 0;
    const handler = async (evt: any) => {
      processedCount++;
      assert.strictEqual(evt.data.orderId, 'ord-101');
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

  test('Enterprise SFA Controller and Use Cases Integration', async () => {
    const { EnterpriseSfaController } = await import('./presentation/rest/controllers/enterprise_sfa.controller.js');
    const ctrl = new EnterpriseSfaController();
    const headers = { 'x-tenant-id': tenantId };

    // 1. BeatRoute
    const brRes = await ctrl.handleCreateBeatRoute({
      id: 'beat-route-1',
      name: 'Delhi NCR Beat',
      region: 'Delhi',
      assignedAgentIds: ['agent-1'],
      outlets: [
        { outletId: 'outlet-1', sequence: 1, lat: 28.6, lng: 77.2 },
        { outletId: 'outlet-2', sequence: 2, lat: 28.7, lng: 77.3 }
      ],
      frequency: 'daily'
    }, headers);
    assert.strictEqual(brRes.statusCode, 201);
    assert.strictEqual((brRes.body.beatRoute as any).name, 'Delhi NCR Beat');

    // 2. Attendance Check-in & Check-out
    const attInRes = await ctrl.handleCheckInAttendance({
      id: 'att-1',
      agentId: 'agent-1',
      date: '2026-06-04',
      lat: 28.6,
      lng: 77.2
    }, headers);
    assert.strictEqual(attInRes.statusCode, 200);
    assert.strictEqual((attInRes.body.attendance as any).status, 'checked_in');

    const attOutRes = await ctrl.handleCheckOutAttendance({
      id: 'att-1',
      lat: 28.6,
      lng: 77.2
    }, headers);
    assert.strictEqual(attOutRes.statusCode, 200);
    assert.strictEqual((attOutRes.body.attendance as any).status, 'approved');

    // 3. GeoCheckIn
    const geoRes = await ctrl.handleRecordGeoCheckIn({
      id: 'geo-1',
      agentId: 'agent-1',
      outletId: 'outlet-1',
      visitId: 'visit-1',
      lat: 28.6139,
      lng: 77.2090,
      outletLat: 28.6140,
      outletLng: 77.2090,
      deviceInfo: { model: 'iPhone 15', os: 'iOS', batteryLevel: 90 }
    }, headers);
    assert.strictEqual(geoRes.statusCode, 201);
    assert.strictEqual((geoRes.body.checkIn as any).isWithinGeofence, true);

    // 4. OutletCensus
    const censusRes = await ctrl.handleSubmitCensus({
      id: 'census-1',
      outletId: 'outlet-new-1',
      agentId: 'agent-1',
      outletName: 'New Grocery Store',
      outletType: 'kirana',
      ownerName: 'Rahul',
      ownerPhone: '9999999999',
      address: 'CP, Delhi',
      lat: 28.6,
      lng: 77.2
    }, headers);
    assert.strictEqual(censusRes.statusCode, 201);
    assert.strictEqual((censusRes.body.census as any).status, 'submitted');

    const verifyRes = await ctrl.handleVerifyCensus({
      id: 'census-1',
      verified: true
    }, headers);
    assert.strictEqual(verifyRes.statusCode, 200);
    assert.strictEqual((verifyRes.body.census as any).status, 'approved');

    // 5. VanSale load & record spot sale
    const loadRes = await ctrl.handleLoadVanInventory({
      id: 'van-1',
      agentId: 'agent-1',
      vehicleId: 'DL-3C-1234',
      routeId: 'beat-route-1',
      loadedItems: [{ skuId: 'sku-A', qty: 100, batchNumber: 'B1' }]
    }, headers);
    assert.strictEqual(loadRes.statusCode, 201);

    const saleRes = await ctrl.handleRecordSpotSale({
      id: 'van-1',
      outletId: 'outlet-1',
      saleItems: [{ skuId: 'sku-A', qty: 20, unitPrice: 500 }],
      paymentCollected: 10000
    }, headers);
    assert.strictEqual(saleRes.statusCode, 200);
    assert.strictEqual((saleRes.body.vanSale as any).status, 'closed');

    // 6. OrderApproval
    const appReqRes = await ctrl.handleRequestOrderApproval({
      id: 'app-1',
      orderId: 'ord-99',
      requestedBy: 'agent-1',
      amount: 15000,
      thresholdAmount: 10000
    }, headers);
    assert.strictEqual(appReqRes.statusCode, 201);
    assert.strictEqual((appReqRes.body.approval as any).status, 'pending');

    const appRes = await ctrl.handleApproveOrder({
      id: 'app-1',
      approvedBy: 'manager-1'
    }, headers);
    assert.strictEqual(appRes.statusCode, 200);
    assert.strictEqual((appRes.body.approval as any).status, 'approved');

    // 7. MerchandisingAudit
    const auditRes = await ctrl.handleSubmitMerchandisingAudit({
      id: 'audit-1',
      agentId: 'agent-1',
      outletId: 'outlet-1',
      visitId: 'visit-1',
      photos: [{ photoUrl: 'http://img.com/1.png', category: 'shelf' }],
      complianceScore: 85
    }, headers);
    assert.strictEqual(auditRes.statusCode, 201);
    assert.strictEqual((auditRes.body.audit as any).planogramCompliance, 85);
  });
});

