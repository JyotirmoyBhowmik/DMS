import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { PostgresDatabaseClient, PgDriver, MigrationRunner, ConcurrencyError } from '@dms/pkg-database';
import { loadConfigSync } from '@dms/pkg-config';
import { randomUUID, createSign } from 'node:crypto';
import { KeyManager } from '../../identity-service/src/application/usecases/key_manager.js';

import { Batch } from './domain/entities/batch.js';
import { Inventory } from './domain/entities/inventory.js';
import { StockLedgerEntry } from './domain/entities/stock-ledger-entry.js';

import { BatchPgRepository } from './infrastructure/database/repositories/batch.pg-repository.js';
import { InventoryPgRepository } from './infrastructure/database/repositories/inventory.pg-repository.js';
import { StockLedgerPgRepository } from './infrastructure/database/repositories/stock-ledger.pg-repository.js';

import { GatewayController } from '../../api-gateway/src/presentation/rest/controllers/gateway.controller.js';
import { DmsCoreBackgroundWorker } from './worker.js';

const config = loadConfigSync();

describe('DMS Inventory, Batch, & Stock Ledger Lifecycle Integration Tests', () => {
  let pool: Pool;
  let db: PostgresDatabaseClient;

  let batchRepo: BatchPgRepository;
  let inventoryRepo: InventoryPgRepository;
  let stockLedgerRepo: StockLedgerPgRepository;

  let worker: DmsCoreBackgroundWorker;
  let gateway: GatewayController;
  let isDbAlive = false;

  const tenantA = 'a0000000-0000-0000-0000-000000000001';
  const tenantB = 'b0000000-0000-0000-0000-000000000002';
  
  const productIdA = 'a0000000-0000-0000-0000-000000000099';
  const productIdB = 'b0000000-0000-0000-0000-000000000099';

  const warehouseId = 'wh-001';
  const userId = '00000000-0000-0000-0000-000000000009';

  before(async () => {
    // 1. Initialize DB Connection
    pool = new Pool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      connectionTimeoutMillis: 500
    });
    try {
      const client = await pool.connect();
      client.release();
      isDbAlive = true;
    } catch (err) {
      console.log('Skipping DMS Inventory, Batch, & Stock Ledger Lifecycle Integration Tests because live database is not reachable.');
      return;
    }
    const driver = new PgDriver(pool);
    db = new PostgresDatabaseClient(config.db, driver);

    batchRepo = new BatchPgRepository(db);
    inventoryRepo = new InventoryPgRepository(db);
    stockLedgerRepo = new StockLedgerPgRepository(db);

    // 2. Resolve migration directories
    const rootDir = process.cwd();
    const systemMigrationsDir = existsSync(join(rootDir, 'db/migrations/system/V001__create_system_tables.sql'))
      ? join(rootDir, 'db/migrations/system')
      : join(rootDir, '../../db/migrations/system');
    
    const dmsMigrationsDir = existsSync(join(rootDir, 'db/migrations/dms/V001__create_dms_tables.sql'))
      ? join(rootDir, 'db/migrations/dms')
      : join(rootDir, '../../db/migrations/dms');

    console.log(`[Inventory Test] Dropping and recreating public schema for clean tests`);
    await db.query('DROP SCHEMA IF EXISTS public CASCADE');
    await db.query('CREATE SCHEMA public');
    await db.query('GRANT ALL ON SCHEMA public TO public');

    // Run system migrations
    console.log(`[Inventory Test] Running system migrations from: ${systemMigrationsDir}`);
    const systemRunner = new MigrationRunner(db, { migrationsDir: systemMigrationsDir });
    await systemRunner.migrate();

    // Run DMS migrations
    console.log(`[Inventory Test] Running DMS migrations from: ${dmsMigrationsDir}`);
    const dmsRunner = new MigrationRunner(db, { migrationsDir: dmsMigrationsDir, tableName: 'dms_schema_migrations' });
    await dmsRunner.migrate();

    // 3. Initialize Gateway & Background Worker
    gateway = new GatewayController();
    worker = new DmsCoreBackgroundWorker();
    await worker.start();
  });

  after(async () => {
    if (worker && isDbAlive) {
      await worker.stop();
    }
    if (db && isDbAlive) {
      await db.shutdown();
    }
    if (pool && isDbAlive) {
      await pool.end().catch(() => {});
    }
  });

  beforeEach(async () => {
    if (!isDbAlive) return;
    // Clear tables
    await db.query(`SET app.tenant_id = '${tenantA}'`);
    await db.query(
      'TRUNCATE TABLE products_skus, batches, stock_ledger, inventory_records, dms_outbox RESTART IDENTITY CASCADE'
    );

    // Insert prerequisite products
    await db.query(
      `INSERT INTO products_skus (id, tenant_id, sku, name, category, price, min_threshold)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [productIdA, tenantA, 'SKU-A', 'Product A', 'Oil', 1000, 10],
      tenantA
    );

    await db.query(`SET app.tenant_id = '${tenantB}'`);
    await db.query(
      `INSERT INTO products_skus (id, tenant_id, sku, name, category, price, min_threshold)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [productIdB, tenantB, 'SKU-B', 'Product B', 'Flour', 800, 15],
      tenantB
    );
  });

  // ─── 1. DOMAIN UNIT TESTS ──────────────────────────────────────────────────
  test('Domain: Batch sorting by FEFO', (t) => {
    if (!isDbAlive) { t?.skip?.(); return; }
    const b1 = Batch.create({
      id: randomUUID(),
      tenantId: tenantA,
      productId: productIdA,
      batchNumber: 'B1',
      manufacturingDate: '2026-06-01',
      expiryDate: '2026-07-15',
      quantity: 100,
    });

    const b2 = Batch.create({
      id: randomUUID(),
      tenantId: tenantA,
      productId: productIdA,
      batchNumber: 'B2',
      manufacturingDate: '2026-06-01',
      expiryDate: '2026-07-05',
      quantity: 100,
    });

    const sorted = Batch.sortByFEFO([b1, b2]);
    assert.strictEqual(sorted[0].batchNumber, 'B2');
    assert.strictEqual(sorted[1].batchNumber, 'B1');
  });

  // ─── 2. REPOSITORY & RLS ISOLATION TESTS ──────────────────────────────────
  test('RLS: Prevent cross-tenant database reads & writes', async (t) => {
    if (!isDbAlive) { t?.skip?.(); return; }
    // 1. Create a batch for Tenant A
    await db.query(`SET app.tenant_id = '${tenantA}'`);
    const batchA = Batch.create({
      id: randomUUID(),
      tenantId: tenantA,
      productId: productIdA,
      batchNumber: 'BA-100',
      manufacturingDate: '2026-06-01',
      expiryDate: '2026-08-01',
      quantity: 50,
    });
    await batchRepo.save(batchA);

    // 2. Set context to Tenant B and try to fetch Tenant A's batch -> should return null due to RLS
    await db.query(`SET app.tenant_id = '${tenantB}'`);
    const fetched = await batchRepo.findById(tenantB, batchA.id);
    assert.strictEqual(fetched, null);
  });

  test('Optimistic Concurrency Lock: Throw ConcurrencyError on out-of-date save', async (t) => {
    if (!isDbAlive) { t?.skip?.(); return; }
    await db.query(`SET app.tenant_id = '${tenantA}'`);
    const batch = Batch.create({
      id: randomUUID(),
      tenantId: tenantA,
      productId: productIdA,
      batchNumber: 'B-100',
      manufacturingDate: '2026-06-01',
      expiryDate: '2026-08-01',
      quantity: 100,
    });

    await batchRepo.save(batch);

    // Load two copies
    const copy1 = await batchRepo.findById(tenantA, batch.id);
    const copy2 = await batchRepo.findById(tenantA, batch.id);

    assert.ok(copy1);
    assert.ok(copy2);

    // Save copy 1 -> increments version
    copy1.deductStock(30);
    await batchRepo.save(copy1);

    // Try to save copy 2 (stale version) -> should throw ConcurrencyError
    copy2.deductStock(40);
    await assert.rejects(
      async () => {
        await batchRepo.save(copy2);
      },
      (err) => err instanceof ConcurrencyError
    );
  });

  // ─── 3. APPLICATION & TRANSACTION LIFE CYCLE TESTS ─────────────────────────
  test('Use Case: Atomic stock adjustment and ledger recording', async (t) => {
    if (!isDbAlive) { t?.skip?.(); return; }
    const useCases = gateway['enterpriseDmsController']['useCases'];

    // 1. Trigger stock adjustment (INWARD)
    const entry = await useCases.adjustStock({
      id: randomUUID(),
      tenantId: tenantA,
      productId: productIdA,
      warehouseId,
      batchNumber: 'B-IN-1',
      transactionType: 'INWARD',
      quantity: 150,
      referenceId: randomUUID(),
      referenceType: 'MANUAL',
      createdBy: userId,
      expiryDate: '2026-09-01',
    });

    assert.strictEqual(entry.quantity, 150);

    // 2. Validate database states
    await db.query(`SET app.tenant_id = '${tenantA}'`);
    
    // Check batch updated
    const batch = await batchRepo.findByBatchNumber(tenantA, productIdA, 'B-IN-1');
    assert.ok(batch);
    assert.strictEqual(batch.quantity, 150);

    // Check inventory record updated
    const inv = await inventoryRepo.findByProductAndWarehouse(productIdA, warehouseId, tenantA);
    assert.ok(inv);
    assert.strictEqual(inv.stock, 150);

    // Check ledger entry exists
    const ledger = await stockLedgerRepo.findByBatch(tenantA, productIdA, 'B-IN-1');
    assert.strictEqual(ledger.length, 1);
    assert.strictEqual(ledger[0].runningBalance, 150);
  });

  test('Use Case: FEFO Stock Allocation across multiple batches', async (t) => {
    if (!isDbAlive) { t?.skip?.(); return; }
    const useCases = gateway['enterpriseDmsController']['useCases'];

    // 1. Create two batches with different expiry dates
    // Batch 1: expires 2026-07-01
    await useCases.adjustStock({
      id: randomUUID(),
      tenantId: tenantA,
      productId: productIdA,
      warehouseId,
      batchNumber: 'B-EXP-EARLY',
      transactionType: 'INWARD',
      quantity: 60,
      referenceId: randomUUID(),
      referenceType: 'MANUAL',
      createdBy: userId,
      expiryDate: '2026-07-01',
    });

    // Batch 2: expires 2026-08-01
    await useCases.adjustStock({
      id: randomUUID(),
      tenantId: tenantA,
      productId: productIdA,
      warehouseId,
      batchNumber: 'B-EXP-LATE',
      transactionType: 'INWARD',
      quantity: 100,
      referenceId: randomUUID(),
      referenceType: 'MANUAL',
      createdBy: userId,
      expiryDate: '2026-08-01',
    });

    // 2. Allocate 80 units
    const result = await useCases.allocateStockFEFO({
      tenantId: tenantA,
      productId: productIdA,
      warehouseId,
      quantity: 80,
      referenceId: randomUUID(),
      referenceType: 'ORDER',
      createdBy: userId,
    });

    // 3. Verify FEFO logic:
    // It should fully deplete B-EXP-EARLY (60 units) and take 20 units from B-EXP-LATE
    assert.strictEqual(result.allocated.length, 2);
    assert.strictEqual(result.allocated[0].batchNumber, 'B-EXP-EARLY');
    assert.strictEqual(result.allocated[0].quantity, 60);
    assert.strictEqual(result.allocated[1].batchNumber, 'B-EXP-LATE');
    assert.strictEqual(result.allocated[1].quantity, 20);

    // Verify database counts
    await db.query(`SET app.tenant_id = '${tenantA}'`);
    
    const bEarly = await batchRepo.findByBatchNumber(tenantA, productIdA, 'B-EXP-EARLY');
    assert.strictEqual(bEarly?.quantity, 0); // Depleted batch is status EXPIRED & quantity 0
    assert.strictEqual(bEarly?.status, 'EXPIRED');

    const bLate = await batchRepo.findByBatchNumber(tenantA, productIdA, 'B-EXP-LATE');
    assert.strictEqual(bLate?.quantity, 80); // 100 - 20 = 80

    const inv = await inventoryRepo.findByProductAndWarehouse(productIdA, warehouseId, tenantA);
    assert.strictEqual(inv?.stock, 80); // 160 total - 80 allocated = 80 remaining
  });

  test('Concurrency: Prevent negative stock under parallel allocations', async (t) => {
    if (!isDbAlive) { t?.skip?.(); return; }
    const useCases = gateway['enterpriseDmsController']['useCases'];

    // 1. Seed batch with 50 units
    await useCases.adjustStock({
      id: randomUUID(),
      tenantId: tenantA,
      productId: productIdA,
      warehouseId,
      batchNumber: 'B-CONC',
      transactionType: 'INWARD',
      quantity: 50,
      referenceId: randomUUID(),
      referenceType: 'MANUAL',
      createdBy: userId,
      expiryDate: '2026-09-01',
    });

    // 2. Trigger two concurrent allocations of 30 units each
    // One must succeed, one must fail with insufficient stock error
    const alloc1 = useCases.allocateStockFEFO({
      tenantId: tenantA,
      productId: productIdA,
      warehouseId,
      quantity: 30,
      referenceId: randomUUID(),
      referenceType: 'ORDER',
      createdBy: userId,
    });

    const alloc2 = useCases.allocateStockFEFO({
      tenantId: tenantA,
      productId: productIdA,
      warehouseId,
      quantity: 30,
      referenceId: randomUUID(),
      referenceType: 'ORDER',
      createdBy: userId,
    });

    const results = await Promise.allSettled([alloc1, alloc2]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1);
    assert.strictEqual(rejected.length, 1);
    assert.ok((rejected[0] as PromiseRejectedResult).reason.message.includes('Insufficient stock'));

    // Check final stock is exactly 20
    await db.query(`SET app.tenant_id = '${tenantA}'`);
    const inv = await inventoryRepo.findByProductAndWarehouse(productIdA, warehouseId, tenantA);
    assert.strictEqual(inv?.stock, 20);
  });

  // ─── 4. ENDPOINT & GATEWAY INTEGRATION TESTS ──────────────────────────────
  test('E2E: Gateway routing for stock adjustment, FEFO allocation, and outbox event ingestion', async (t) => {
    if (!isDbAlive) { t?.skip?.(); return; }
    // 1. Simulate POST /api/v1/inventory (adjust stock) via Gateway
    const headers = {
      'authorization': 'Bearer mock-token', // JWT validation mocked/skipped in gateway controller's token simulation block
      'x-tenant-id': tenantA,
    };
    
    // Gateway token structure requires signing
    const keyRecord = KeyManager.getInstance().getSigningKey();
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;

    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: keyRecord.kid })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: userId,
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
    const authHeaders = {
      'authorization': `Bearer ${token}`,
      'x-tenant-id': tenantA,
    };

    const adjId = randomUUID();
    const adjustResponse = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/inventory',
      headers: authHeaders,
      body: {
        id: adjId,
        productId: productIdA,
        warehouseId,
        batchNumber: 'B-E2E-1',
        transactionType: 'INWARD',
        quantity: 200,
        referenceId: randomUUID(),
        referenceType: 'MANUAL',
        createdBy: userId,
        expiryDate: '2026-12-01',
      },
    });

    assert.strictEqual(adjustResponse.status, 200);
    assert.ok((adjustResponse.body as any).success);

    // 2. Wait for outbox dispatcher to poll and send event
    await new Promise(resolve => setTimeout(resolve, 1200));

    // 3. Verify outbox row marked as published
    await db.query(`SET app.tenant_id = '${tenantA}'`);
    const outboxRows = await db.query<any>(
      `SELECT * FROM dms_outbox WHERE published_at IS NOT NULL`,
      [],
      tenantA
    );
    assert.ok(outboxRows.rows.length > 0);
  });
});
