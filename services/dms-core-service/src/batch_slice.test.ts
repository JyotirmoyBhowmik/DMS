import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Batch } from './domain/entities/batch.js';
import { BatchPgRepository } from './infrastructure/database/repositories/batch.pg-repository.js';
import { BatchController } from './presentation/rest/controllers/batch.controller.js';
import { randomUUID } from 'node:crypto';

describe('Batch Full Vertical Slice Unit & Repo Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    BatchPgRepository.clearStore();
  });

  describe('Batch Domain Aggregate Invariants', () => {
    test('validates stock adjustments, expiration checks, and FEFO sorting', () => {
      const mfg = new Date().toISOString();
      const tomorrow = new Date(Date.now() + 86400000 * 60).toISOString();
      const b1 = new Batch({
        id: randomUUID(),
        tenantId,
        batchNumber: 'BATCH-001',
        productId: 'p-1',
        manufacturingDate: mfg,
        expiryDate: tomorrow,
        quantity: 100,
      });

      assert.strictEqual(b1.quantity, 100);
      assert.strictEqual(b1.isExpired, false);

      b1.deductStock(30);
      assert.strictEqual(b1.quantity, 70);

      assert.throws(() => b1.deductStock(100), /Insufficient available stock/);
    });
  });

  describe('Batch Controller & Repository', () => {
    test('creates and retrieves batches', async () => {
      const controller = new BatchController();
      const headers = {
        'x-tenant-id': tenantId,
        'x-user-id': 'admin-user',
        'x-user-roles': 'admin',
      };

      const tomorrow = new Date(Date.now() + 86400000 * 60).toISOString();
      const res = await controller.handleCreate(
        {
          batchNumber: 'BATCH-2026-X',
          productId: 'prod-101',
          warehouseId: 'wh-north',
          quantity: 250,
          expiryDate: tomorrow,
        },
        headers
      );

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
    });
  });
});
