import { OrderController } from './presentation/rest/controllers/order.controller.js';
import { VisitController } from './presentation/rest/controllers/visit.controller.js';
import { CorrelationContext } from '@dms/pkg-logger';
import { randomUUID } from 'crypto';

const orderController = new OrderController();
const visitController = new VisitController();

const mockOrderRequest = {
  outletId: '3c0a52f4-d5d4-47c0-a7d4-8d48177dfc89',
  items: [
    { skuId: 'bf9d22c9-65fe-4d7a-a682-62fe8324e93f', quantity: 2, price: 12.50 }
  ],
  notes: 'Fragile. Deliver between 9 AM and 12 PM.'
};

const mockHeaders = {
  'x-tenant-id': 'tenant-uuid-1111',
  'x-agent-id': 'agent-uuid-2222',
};

async function bootstrap() {
  await CorrelationContext.run({ correlationId: randomUUID(), tenantId: 'tenant-uuid-1111' }, async () => {
    process.stdout.write(`\n=== SFA-SERVICE BOOTSTRAP ===\n`);

    // 1. Place an Order
    const orderResponse = await orderController.handlePostOrder(mockOrderRequest, mockHeaders);
    process.stdout.write(`\n🛒 Order Placement (status=${orderResponse.statusCode}):\n`);
    process.stdout.write(JSON.stringify(orderResponse.body, null, 2) + `\n`);

    // 2. Perform Geofenced Agent Visit Check-in
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

    // 3. Perform Check-out
    // Wait briefly to simulate duration
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const checkOut = await visitController.handleCheckOut(visitId, compliantLat, 77.2090, mockHeaders);
    process.stdout.write(`\n🏁 Agent Check-out (status=${checkOut.status}):\n`);
    process.stdout.write(`  Success: ${(checkOut.body as any).success} | Duration: ${(checkOut.body as any).durationMinutes} min | Message: ${(checkOut.body as any).message}\n`);

    process.stdout.write('\n=== SFA-SERVICE BOOTSTRAP COMPLETE ===\n');
  });
}

bootstrap();
