import { ClaimController } from './presentation/rest/controllers/claim.controller.js';
import { CorrelationContext } from '@dms/pkg-logger';
import { randomUUID } from 'crypto';

const controller = new ClaimController();

const mockClaimRequest = {
  distributorId: randomUUID(),
  schemeId: randomUUID(),
  amount: 50000,
  duplicateCheckKey: 'claim-duplicate-key-mock',
};

const mockHeaders = {
  'x-tenant-id': 'tenant-uuid-1111',
};

async function bootstrap() {
  await CorrelationContext.run({ correlationId: randomUUID(), tenantId: 'tenant-uuid-1111' }, async () => {
    process.stdout.write(`\n=== CLAIMS-SERVICE BOOTSTRAP ===\n`);

    const response = await controller.handlePostClaim(mockClaimRequest, mockHeaders);
    process.stdout.write(`\n📝 Claim Creation (status=${response.statusCode}):\n`);
    process.stdout.write(JSON.stringify(response.body, null, 2) + `\n`);

    if (response.body.success) {
      const getRes = await controller.handleGetClaim(response.body.claimId, mockHeaders);
      process.stdout.write(`\n📝 Claim Retrieve (status=${getRes.statusCode}):\n`);
      process.stdout.write(`  ID: ${getRes.body.claim.id} | Status: ${getRes.body.claim.status} | Amount: ${getRes.body.claim.amount}\n`);
    }

    process.stdout.write('\n=== CLAIMS-SERVICE BOOTSTRAP COMPLETE ===\n');
  });
}

bootstrap();
