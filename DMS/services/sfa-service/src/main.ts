import { OrderController } from './presentation/rest/controllers/order.controller.js';
import { VisitController } from './presentation/rest/controllers/visit.controller.js';
import { JourneyPlanController } from './presentation/rest/controllers/journey_plan.controller.js';
import { EventConsumer } from './presentation/events/event_consumer.js';
import { CorrelationContext } from '@dms/pkg-logger';
import { randomUUID } from 'crypto';

const orderController = new OrderController();
const visitController = new VisitController();
const journeyPlanController = new JourneyPlanController();
const eventConsumer = new EventConsumer();

const mockOrderRequest = {
  outletId: '3c0a52f4-d5d4-47c0-a7d4-8d48177dfc89',
  items: [
    { skuId: 'bf9d22c9-65fe-4d7a-a682-62fe8324e93f', quantity: 2, price: 12.50 }
  ],
  notes: 'Fragile. Deliver between 9 AM and 12 PM.'
};

const mockJourneyPlanRequest = {
  date: '2026-06-04',
  beatId: 'b80a52f4-d5d4-47c0-a7d4-8d48177dfc89',
  beatName: 'Central Beat Delhi',
  plannedOutlets: [
    {
      outletId: '3c0a52f4-d5d4-47c0-a7d4-8d48177dfc89',
      outletName: 'Delhi Central Store',
      sequence: 1,
      latitude: 28.6139,
      longitude: 77.2090,
      estimatedArrival: new Date().toISOString(),
    }
  ]
};

const mockHeaders = {
  'x-tenant-id': 'tenant-uuid-1111',
  'x-agent-id': 'agent-uuid-2222',
};

async function bootstrap() {
  await CorrelationContext.run({ correlationId: randomUUID(), tenantId: 'tenant-uuid-1111' }, async () => {
    process.stdout.write(`\n=== SFA-SERVICE BOOTSTRAP ===\n`);

    // 1. Create and Fetch JourneyPlan
    const planResponse = await journeyPlanController.handleCreateJourneyPlan(mockJourneyPlanRequest, mockHeaders);
    process.stdout.write(`\n🗺️ JourneyPlan Creation (status=${planResponse.statusCode}):\n`);
    process.stdout.write(JSON.stringify(planResponse.body, null, 2) + `\n`);

    const planGet = await journeyPlanController.handleGetAgentJourney('agent-uuid-2222', '2026-06-04', mockHeaders);
    process.stdout.write(`\n🗺️ JourneyPlan Retrieve (status=${planGet.statusCode}):\n`);
    process.stdout.write(`  Status: ${(planGet.body as any).plan?.status} | Outlets: ${(planGet.body as any).plan?.plannedOutlets?.length}\n`);

    // 2. Place an Order
    const orderResponse = await orderController.handlePostOrder(mockOrderRequest, mockHeaders);
    process.stdout.write(`\n🛒 Order Placement (status=${orderResponse.statusCode}):\n`);
    process.stdout.write(JSON.stringify(orderResponse.body, null, 2) + `\n`);

    // 3. Perform Geofenced Agent Visit Check-in
    const visitId = 'visit-1001';
    
    // Delhi reference coordinate: 28.6139, 77.2090
    const compliantLat = 28.6140; // ~11 meters (Compliant)
    const distantLat = 28.6190;   // ~560 meters (Violates geofence limit of 50m)

    // Check-in (Non-compliant coordinates)
    const checkInFail = await visitController.handleCheckIn(visitId, distantLat, 77.2090, mockHeaders);
    process.stdout.write(`\n📍 Agent Check-in Attempt 1: Distant Coordinates (status=${checkInFail.status}):\n`);
    process.stdout.write(`  Error: ${(checkInFail.body as any).error} | Distance: ${(checkInFail.body as any).distanceMeters}m | Code: ${(checkInFail.body as any).code}\n`);

    // Check-in (Compliant coordinates)
    const checkInSuccess = await visitController.handleCheckIn(visitId, compliantLat, 77.2090, mockHeaders);
    process.stdout.write(`\n📍 Agent Check-in Attempt 2: Compliant Coordinates (status=${checkInSuccess.status}):\n`);
    process.stdout.write(`  Compliant: ${(checkInSuccess.body as any).success} | Distance: ${(checkInSuccess.body as any).distanceMeters}m | Message: ${(checkInSuccess.body as any).message}\n`);

    // 4. Perform Check-out
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const checkOut = await visitController.handleCheckOut(visitId, compliantLat, 77.2090, mockHeaders);
    process.stdout.write(`\n🏁 Agent Check-out (status=${checkOut.status}):\n`);
    process.stdout.write(`  Success: ${(checkOut.body as any).success} | Duration: ${(checkOut.body as any).durationMinutes} min | Message: ${(checkOut.body as any).message}\n`);

    // 5. Test Event Deduplication (Idempotent Consumer)
    if (orderResponse.statusCode === 201) {
      const mockEvent = {
        eventId: 'evt-order-placed-dedupe-1',
        eventType: 'order.placed',
        tenantId: 'tenant-uuid-1111',
        data: { orderId: (orderResponse.body as any).orderId }
      };

      const handler = async (evt: any) => {
        process.stdout.write(`  [HANDLER] Handling event: ${evt.eventId} for order ${evt.data.orderId}\n`);
      };

      process.stdout.write(`\n🔄 Consuming event the first time:\n`);
      const ingest1 = await eventConsumer.consume(mockEvent as any, handler);
      process.stdout.write(`  Result 1: ${ingest1.status}\n`);

      process.stdout.write(`\n🔄 Consuming event the second time (duplicate):\n`);
      const ingest2 = await eventConsumer.consume(mockEvent as any, handler);
      process.stdout.write(`  Result 2: ${ingest2.status}\n`);
    }

    process.stdout.write('\n=== SFA-SERVICE BOOTSTRAP COMPLETE ===\n');
  });
}

bootstrap();

