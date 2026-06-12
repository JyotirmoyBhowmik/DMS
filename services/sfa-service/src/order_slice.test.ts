import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { createSign } from 'node:crypto';
import { PostgresDatabaseClient, PgDriver, MigrationRunner, ConcurrencyError, EntityNotFoundError } from '@dms/pkg-database';
import { loadConfigSync } from '@dms/pkg-config';
import { OrderEntity } from './domain/entities/order.entity.js';
import { OrderAggregate } from './domain/aggregates/order.aggregate.js';
import { OrderPgRepository } from './infrastructure/database/repositories/order.pg-repository.js';
import { GatewayController } from '../../api-gateway/src/presentation/rest/controllers/gateway.controller.js';
import { SfaBackgroundWorker } from './worker.js';
import { KeyManager } from '../../identity-service/src/application/usecases/key_manager.js';

const config = loadConfigSync();

describe('Order Creation Vertical Slice & E2E Integration Tests', () => {
  let pool: Pool;
  let db: PostgresDatabaseClient;
  let orderRepo: OrderPgRepository;
  let worker: SfaBackgroundWorker;
  let gateway: GatewayController;

  const tenantA = 'a0000000-0000-0000-0000-000000000001';
  const tenantB = 'b0000000-0000-0000-0000-000000000002';
  const agentId = '00000000-0000-0000-0000-000000000003';
  const outletId = '00000000-0000-0000-0000-000000000004';
  const skuId = '00000000-0000-0000-0000-000000000005';

  before(async () => {
    // 1. Initialize Database Connection
    pool = new Pool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
    });
    const driver = new PgDriver(pool);
    db = new PostgresDatabaseClient(config.db, driver);
    orderRepo = new OrderPgRepository(db);

    // 2. Resolve migration directories
    const rootDir = process.cwd();
    const systemMigrationsDir = existsSync(join(rootDir, 'db/migrations/system'))
      ? join(rootDir, 'db/migrations/system')
      : join(rootDir, '../../db/migrations/system');
    
    const sfaMigrationsDir = existsSync(join(rootDir, 'db/migrations/sfa'))
      ? join(rootDir, 'db/migrations/sfa')
      : join(rootDir, '../../db/migrations/sfa');

    console.log(`[Slice Test] Dropping and recreating public schema for clean tests`);
    await db.query('DROP SCHEMA public CASCADE');
    await db.query('CREATE SCHEMA public');
    await db.query('GRANT ALL ON SCHEMA public TO public');

    // Run system migrations
    console.log(`[Slice Test] Running system migrations from: ${systemMigrationsDir}`);
    const systemRunner = new MigrationRunner(db, { migrationsDir: systemMigrationsDir });
    await systemRunner.migrate();

    // Run SFA migrations
    console.log(`[Slice Test] Running SFA migrations from: ${sfaMigrationsDir}`);
    const sfaRunner = new MigrationRunner(db, { migrationsDir: sfaMigrationsDir, tableName: 'sfa_schema_migrations' });
    await sfaRunner.migrate();

    // 3. Initialize Gateway
    gateway = new GatewayController();

    // 4. Initialize worker
    worker = new SfaBackgroundWorker();
    await worker.start();
  });

  after(async () => {
    if (worker) {
      await worker.stop();
    }
    if (db) {
      await db.shutdown();
    }
    if (pool) {
      await pool.end().catch(() => {});
    }
  });

  beforeEach(async () => {
    // Clear the tables
    await db.query(`SET app.tenant_id = '${tenantA}'`);
    await db.query('TRUNCATE TABLE orders, sfa_outbox, processed_events RESTART IDENTITY CASCADE');
  });

  // ─── 1. DOMAIN UNIT TESTS ──────────────────────────────────────────────────
  test('Domain: OrderAggregate validates invariants and calculates subtotals correctly', () => {
    const entity = new OrderEntity({
      id: '00000000-0000-0000-0000-000000000010',
      tenantId: tenantA,
      outletId,
      items: [
        { skuId, quantity: 5, price: 100 }, // subtotal: 500
      ],
    });

    const aggregate = new OrderAggregate(entity);
    aggregate.validateInvariants();
    assert.strictEqual(aggregate.calculateSubtotal(), 500);

    aggregate.place();
    assert.strictEqual(entity.status, 'placed');

    aggregate.recomputeTotals(18.0, 50); // 18% standard GST, 50 discount.
    assert.strictEqual(entity.totalAmount, 531);
  });

  // ─── 2. REPOSITORY INTEGRATION TESTS ───────────────────────────────────────
  test('Repo: Save, find, and update with optimistic locking and RLS context', async () => {
    const entity = new OrderEntity({
      id: '00000000-0000-0000-0000-000000000020',
      tenantId: tenantA,
      outletId,
      items: [{ skuId, quantity: 2, price: 500 }],
      totalAmount: 1180, // gross: 1000, tax: 180
      status: 'placed',
      idempotencyKey: 'idem-test-repo-1',
    });

    // 1. Save
    await orderRepo.save(entity, tenantA);

    // 2. Find
    const saved = await orderRepo.findById(entity.id, tenantA);
    assert.strictEqual(saved.id, entity.id);
    assert.strictEqual(saved.version, 1);
    assert.strictEqual(saved.totalAmount, 1180);

    // 3. Update (Optimistic Locking success)
    saved.totalAmount = 1200;
    const updated = await orderRepo.update(saved, tenantA);
    assert.strictEqual(updated.version, 2);
    assert.strictEqual(updated.totalAmount, 1200);

    // 4. Update with stale version (Optimistic Locking failure)
    saved.version = 1; // force old version
    await assert.rejects(
      async () => {
        await orderRepo.update(saved, tenantA);
      },
      (err: any) => {
        return err instanceof ConcurrencyError;
      }
    );
  });

  test('RLS: Prevent Tenant B from reading or updating Tenant A\'s orders', async () => {
    const entity = new OrderEntity({
      id: '00000000-0000-0000-0000-000000000030',
      tenantId: tenantA,
      outletId,
      items: [{ skuId, quantity: 1, price: 100 }],
      totalAmount: 118,
      status: 'placed',
      idempotencyKey: 'idem-test-rls-1',
    });

    // Save as Tenant A
    await orderRepo.save(entity, tenantA);

    // Try to find as Tenant B (RLS isolation)
    await assert.rejects(
      async () => {
        await orderRepo.findById(entity.id, tenantB);
      },
      (err: any) => {
        return err instanceof EntityNotFoundError;
      }
    );

    // Try to update as Tenant B (RLS isolation)
    entity.tenantId = tenantB;
    await assert.rejects(
      async () => {
        await orderRepo.update(entity, tenantB);
      },
      (err: any) => {
        return err instanceof ConcurrencyError; // Update fails because it can't find matching row under tenant B context
      }
    );
  });

  // ─── 3. E2E HAPPY PATH TEST ────────────────────────────────────────────────
  test('E2E: Create order via Gateway, verify RLS persistence, outbox event generation, and idempotent consumer reaction', async () => {
    // 1. Generate valid JWT Token for Tenant A agent
    const keyRecord = KeyManager.getInstance().getSigningKey();
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;
    
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: keyRecord.kid })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: agentId,
      email: 'agent@enterprise-dms.com',
      tenantId: tenantA,
      roles: ['admin'],
      iss: config.security.jwtIssuer,
      aud: config.security.jwtAudience,
      iat,
      exp,
    })).toString('base64url');

    const signatureInput = `${header}.${payload}`;
    const signer = createSign('RSA-SHA256');
    signer.update(signatureInput);
    const signature = signer.sign(keyRecord.privateKey, 'base64url');
    const token = `${signatureInput}.${signature}`;

    const orderId = '00000000-0000-0000-0000-000000000040';

    // 2. Submit order creation request to API Gateway
    const result = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/orders',
      headers: {
        'authorization': `Bearer ${token}`,
        'x-tenant-id': tenantA,
      },
      body: {
        id: orderId,
        outletId,
        items: [
          { skuId, quantity: 10, price: 100 },
        ],
        notes: 'Deliver to front desk',
      },
    });

    assert.strictEqual(result.status, 201);
    assert.strictEqual(result.body.success, true);
    assert.strictEqual(result.body.status, 'confirmed');
    assert.strictEqual(result.body.netTotal, 1180);

    // 3. Verify Order was saved to the real DB under Tenant A
    const orderInDb = await orderRepo.findById(orderId, tenantA);
    assert.strictEqual(orderInDb.id, orderId);
    assert.strictEqual(orderInDb.status, 'confirmed');

    // 4. Wait for Outbox Dispatcher to poll/publish, and consumer to process
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 5. Verify the outbox events were dispatched
    const outboxRows = await db.query<any>(
      `SELECT * FROM sfa_outbox WHERE aggregate_id = $1`,
      [orderId],
      tenantA
    );
    assert.ok(outboxRows.rows.length > 0);
    assert.ok(outboxRows.rows.every(row => row.status === 'PUBLISHED' || row.published_at !== null));

    // 6. Verify the event was consumed and recorded in processed_events table idempotently
    const processedRows = await db.query<any>(
      `SELECT * FROM processed_events WHERE consumer_group = $1`,
      ['sfa-order-service']
    );
    assert.ok(processedRows.rows.length > 0);
  });
});
