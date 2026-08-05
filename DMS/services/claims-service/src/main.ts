import { ClaimController } from './presentation/rest/controllers/claim.controller.js';
import { CorrelationContext } from '@dms/pkg-logger';
import { randomUUID } from 'node:crypto';

const controller = new ClaimController();

const mockClaimRequest = {
  name: 'Q1 Sales Rebate Claim',
  claimCode: `CLAIM-${Date.now()}`,
  distributorId: randomUUID(),
  schemeId: randomUUID(),
  claimAmountCents: 50000,
};

const mockHeaders = {
  'x-tenant-id': '00000000-0000-0000-0000-000000000001',
  'x-user-id': 'mock-user-uuid',
  'x-user-roles': 'admin',
};

async function bootstrap() {
  await CorrelationContext.run({ correlationId: randomUUID(), tenantId: mockHeaders['x-tenant-id'] }, async () => {
    process.stdout.write(`\n=== CLAIMS-SERVICE BOOTSTRAP ===\n`);

    const response = await controller.handleCreate(mockClaimRequest, mockHeaders);
    process.stdout.write(`\n📝 Claim Creation (status=${response.statusCode}):\n`);
    process.stdout.write(JSON.stringify(response.body, null, 2) + `\n`);

    if (response.body.success) {
      const getRes = await controller.handleGet((response.body.claim as any).id, mockHeaders);
      process.stdout.write(`\n📝 Claim Retrieve (status=${getRes.statusCode}):\n`);
      process.stdout.write(`  ID: ${(getRes.body as any).claim?.id} | Status: ${(getRes.body as any).claim?.status} | Amount: ${(getRes.body as any).claim?.claimAmountCents}\n`);
    }

    process.stdout.write('\n=== CLAIMS-SERVICE BOOTSTRAP COMPLETE ===\n');
  });
}

bootstrap();
