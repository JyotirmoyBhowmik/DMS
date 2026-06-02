import { AuditController } from './presentation/rest/controllers/audit.controller.js';

const controller = new AuditController();
const headers = { 'x-tenant-id': 'tenant-uuid-1111' };

async function bootstrap() {
  process.stdout.write('\n=== AUDIT-SERVICE BOOTSTRAP ===\n');

  // 1. Record several audit events
  await controller.handlePostRecordEvent({ eventId: 'evt-101', type: 'order.placed', data: { total: 250 } }, headers);
  await controller.handlePostRecordEvent({ eventId: 'evt-102', type: 'inventory.replenished', data: { replenished: 100 } }, headers);
  await controller.handlePostRecordEvent({ eventId: 'evt-103', type: 'user.onboarded', data: { name: 'Metro Store' } }, headers);

  // 2. Verify integrity of current chain
  const ver1 = await controller.handleVerifyChain();
  process.stdout.write(`\n🛡️ Verification 1: Intact Chain (status=${ver1.statusCode}):\n`);
  process.stdout.write(`  Valid: ${ver1.body.isChainValid} | Blocks: ${ver1.body.totalBlocks}\n`);
  for (const log of ver1.body.logs) {
    process.stdout.write(`    - ${log}\n`);
  }

  // 3. Simulate database tampering on Block 2
  await controller.simulateTampering(2, { eventId: 'evt-101', type: 'order.placed', data: { total: 999999 } }); // tampered amount

  // 4. Verify integrity of chain again
  const ver2 = await controller.handleVerifyChain();
  process.stdout.write(`\n🛡️ Verification 2: Tampered Chain (status=${ver2.statusCode}):\n`);
  process.stdout.write(`  Valid: ${ver2.body.isChainValid} | Blocks: ${ver2.body.totalBlocks}\n`);
  for (const log of ver2.body.logs) {
    process.stdout.write(`    - ${log}\n`);
  }

  process.stdout.write('\n=== AUDIT-SERVICE BOOTSTRAP COMPLETE ===\n');
}

bootstrap();
