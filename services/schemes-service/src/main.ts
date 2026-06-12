import { SchemeController } from './presentation/rest/controllers/scheme.controller.js';
import { CorrelationContext } from '@dms/pkg-logger';
import { randomUUID } from 'crypto';

const controller = new SchemeController();

const mockSchemeRequest = {
  name: 'Festival Discount Scheme',
  description: '10% off for orders above $1000 during festival season',
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  rules: {
    minOrderAmount: 100000, // In cents/paise
  },
  payouts: {
    discountPercentage: 10,
  }
};

const mockHeaders = {
  'x-tenant-id': 'tenant-uuid-1111',
};

async function bootstrap() {
  await CorrelationContext.run({ correlationId: randomUUID(), tenantId: 'tenant-uuid-1111' }, async () => {
    process.stdout.write(`\n=== SCHEMES-SERVICE BOOTSTRAP ===\n`);

    // 1. Create a Scheme
    const response = await controller.handlePostScheme(mockSchemeRequest, mockHeaders);
    process.stdout.write(`\n📝 Scheme Creation (status=${response.statusCode}):\n`);
    process.stdout.write(JSON.stringify(response.body, null, 2) + `\n`);

    // 2. Fetch the Scheme
    if (response.body.success) {
      const getRes = await controller.handleGetScheme(response.body.schemeId, mockHeaders);
      process.stdout.write(`\n📝 Scheme Retrieve (status=${getRes.statusCode}):\n`);
      process.stdout.write(`  Name: ${getRes.body.scheme.name} | Status: ${getRes.body.scheme.status}\n`);
    }

    process.stdout.write('\n=== SCHEMES-SERVICE BOOTSTRAP COMPLETE ===\n');
  });
}

bootstrap();
