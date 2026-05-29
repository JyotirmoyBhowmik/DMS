import { OrderController } from './presentation/rest/controllers/order.controller';
import { CorrelationContext } from '@dms/pkg-logger';
import { randomUUID } from 'crypto';

const controller = new OrderController();

const mockRequest = {
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
    const response = await controller.handlePostOrder(mockRequest, mockHeaders);
    process.stdout.write(`\n=== SFA-SERVICE BOOTSTRAP TEST RESPONSE ===\n`);
    process.stdout.write(JSON.stringify(response, null, 2) + `\n`);
  });
}

bootstrap();
