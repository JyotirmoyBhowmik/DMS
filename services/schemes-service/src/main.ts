import { SchemeController } from './presentation/rest/controllers/scheme.controller.js';
import { CorrelationContext } from '@dms/pkg-logger';
import { randomUUID } from 'crypto';

const controller = new SchemeController();

const mockSchemeRequest = {
  name: 'Festival Discount Scheme',
  code: 'SCH-FESTIVAL-2026',
  schemeType: 'QUANTITY_DISCOUNT',
  description: '10% off for orders above 100 cases during festival season',
};

const mockHeaders = {
  'x-tenant-id': 'tenant-uuid-1111',
  'x-user-id': 'admin-user-id',
  'x-user-roles': 'admin',
};

async function bootstrap() {
  await CorrelationContext.run({ correlationId: randomUUID(), tenantId: 'tenant-uuid-1111' }, async () => {
    process.stdout.write(`\n=== SCHEMES-SERVICE BOOTSTRAP ===\n`);

    // 1. Create a Scheme
    const response = await controller.handleCreate(mockSchemeRequest, mockHeaders);
    process.stdout.write(`\n📝 Scheme Creation (status=${response.statusCode}):\n`);
    process.stdout.write(JSON.stringify(response.body, null, 2) + `\n`);

    // 2. Fetch the Scheme
    if (response.body.success && response.body.scheme) {
      const getRes = await controller.handleGet((response.body.scheme as any).id, mockHeaders);
      process.stdout.write(`\n📝 Scheme Retrieve (status=${getRes.statusCode}):\n`);
      if (getRes.body.success && getRes.body.scheme) {
        process.stdout.write(`  Name: ${getRes.body.scheme.name} | Status: ${getRes.body.scheme.status}\n`);
      }
    }


    process.stdout.write('\n=== SCHEMES-SERVICE BOOTSTRAP COMPLETE ===\n');
  });
}

bootstrap();
