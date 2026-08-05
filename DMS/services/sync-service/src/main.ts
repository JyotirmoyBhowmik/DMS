import { SyncController } from './presentation/rest/controllers/sync.controller.js';

const controller = new SyncController();
const headers = { 'x-tenant-id': 'tenant-uuid-1111' };

async function bootstrap() {
  process.stdout.write('\n=== SYNC-SERVICE BOOTSTRAP ===\n');

  // 1. Normal sync: insert clean mutation
  const normalMutations = [
    {
      id: 'mut-1',
      table: 'orders',
      action: 'insert' as const,
      row: { id: 'ord-202', version: 1, totalAmount: 420, status: 'pending' },
      clientTimestamp: Date.now()
    }
  ];

  const result1 = await controller.handlePostPush(normalMutations, headers);
  process.stdout.write(`\n🔄 Sync 1: Clean Insert (status=${result1.statusCode}):\n`);
  process.stdout.write(`  Processed: ${result1.body.processed} | Conflicts: ${result1.body.conflictsCount}\n`);

  // 2. Conflict sync: client has older version but newer clientTimestamp -> LWW Auto-Resolved
  const lwwMutations = [
    {
      id: 'mut-2',
      table: 'inventory_records',
      action: 'update' as const,
      row: { id: 'inv-001', version: 1, stock: 150 }, // server has version 3 updated at Date.now()-2000
      clientTimestamp: Date.now() // newer timestamp
    }
  ];

  const result2 = await controller.handlePostPush(lwwMutations, headers);
  process.stdout.write(`\n🔄 Sync 2: Version Mismatch / Newer Timestamp -> LWW Auto-Resolved (status=${result2.statusCode}):\n`);
  process.stdout.write(`  Processed: ${result2.body.processed} | Conflicts: ${result2.body.conflictsCount}\n`);
  if (result2.body.conflictsCount > 0) {
    const conflict = result2.body.conflicts[0];
    process.stdout.write(`  [CONFLICT] Resolving to: ${conflict.resolution} | Resolved Stock Level: ${conflict.resolvedRow.stock}\n`);
  }

  // 3. Conflict sync: client has older version and older clientTimestamp -> Manual Review Required
  const manualMutations = [
    {
      id: 'mut-3',
      table: 'orders',
      action: 'update' as const,
      row: { id: 'ord-101', version: 1, totalAmount: 90 }, // server has version 2 updated at Date.now()-5000
      clientTimestamp: Date.now() - 10000 // older timestamp
    }
  ];

  const result3 = await controller.handlePostPush(manualMutations, headers);
  process.stdout.write(`\n🔄 Sync 3: Version Mismatch / Older Timestamp -> Manual Review (status=${result3.statusCode}):\n`);
  process.stdout.write(`  Processed: ${result3.body.processed} | Conflicts: ${result3.body.conflictsCount}\n`);
  if (result3.body.conflictsCount > 0) {
    const conflict = result3.body.conflicts[0];
    process.stdout.write(`  [CONFLICT] Resolving to: ${conflict.resolution} | Server Kept Amount: $${conflict.resolvedRow.totalAmount}\n`);
  }

  process.stdout.write('\n=== SYNC-SERVICE BOOTSTRAP COMPLETE ===\n');
}

bootstrap();
