import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { AuditController } from './presentation/rest/controllers/audit.controller.js';
import { CorrelationContext } from '@dms/pkg-logger';
import { randomUUID } from 'crypto';

describe('Audit Cryptographic Ledger Integrity Tests', () => {
  let controller: AuditController;
  const tenantId = 'tenant-uuid-1111';
  const headers = { 'x-tenant-id': tenantId };

  beforeEach(() => {
    controller = new AuditController();
  });

  test('Ledger should initialize with a single Genesis block', async () => {
    const result = await controller.handleVerifyChain();
    assert.strictEqual(result.statusCode, 200);
    assert.strictEqual(result.body.isChainValid, true);
    assert.strictEqual(result.body.totalBlocks, 1);
    assert.match(result.body.logs[0], /Block #1 hash chain verified/);
  });

  test('Should successfully record audit block and maintain integrity', async () => {
    // 1. Record event
    const recordResult = await controller.handlePostRecordEvent(
      { eventId: 'evt-999', type: 'test.event', data: { value: 100 } },
      headers
    );

    assert.strictEqual(recordResult.statusCode, 201);
    assert.strictEqual(recordResult.body.success, true);
    assert.strictEqual(recordResult.body.blockNumber, 2);
    assert.ok(recordResult.body.hash);

    // 2. Verify chain
    const verifyResult = await controller.handleVerifyChain();
    assert.strictEqual(verifyResult.statusCode, 200);
    assert.strictEqual(verifyResult.body.isChainValid, true);
    assert.strictEqual(verifyResult.body.totalBlocks, 2);
  });

  test('Should detect direct database/chain tampering', async () => {
    // 1. Record two events
    await controller.handlePostRecordEvent({ eventId: 'evt-101', type: 'order.placed', data: { amount: 200 } }, headers);
    await controller.handlePostRecordEvent({ eventId: 'evt-102', type: 'inventory.adjusted', data: { stock: 50 } }, headers);

    // Verify chain is intact
    const verifyBefore = await controller.handleVerifyChain();
    assert.strictEqual(verifyBefore.body.isChainValid, true);
    assert.strictEqual(verifyBefore.body.totalBlocks, 3);

    // 2. Simulate database tampering on Block 2 (the first recorded event)
    await controller.simulateTampering(2, { eventId: 'evt-101', type: 'order.placed', data: { amount: 999999 } });

    // 3. Verify chain again - must detect corruption!
    const verifyAfter = await controller.handleVerifyChain();
    assert.strictEqual(verifyAfter.body.isChainValid, false);
    
    // We should see logs flagging the tampering
    const tamperedLogs = verifyAfter.body.logs.filter((log: string) => log.includes('[TAMPER_DETECTED]'));
    assert.ok(tamperedLogs.length > 0);
  });
});
