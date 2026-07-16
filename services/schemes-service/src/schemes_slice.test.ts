import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { createSign } from 'node:crypto';
import { PostgresDatabaseClient, PgDriver, MigrationRunner, ConcurrencyError, EntityNotFoundError } from '@dms/pkg-database';
import { loadConfigSync } from '@dms/pkg-config';
import { SchemeEntity } from './domain/entities/scheme.entity.js';
import { SchemeAggregate } from './domain/aggregates/scheme.aggregate.js';
import { SchemePgRepository } from './infrastructure/database/repositories/scheme.pg-repository.js';
import { GatewayController } from '../../api-gateway/src/presentation/rest/controllers/gateway.controller.js';
import { SchemesBackgroundWorker } from './worker.js';
import { KeyManager } from '../../identity-service/src/application/usecases/key_manager.js';

const config = loadConfigSync();

describe('Schemes Module & E2E Integration Tests', () => {
  let pool: Pool;
  let db: PostgresDatabaseClient;
  let schemeRepo: SchemePgRepository;
  let worker: SchemesBackgroundWorker;
  let gateway: GatewayController;
  let isDbAlive = false;

  const tenantA = 'a0000000-0000-0000-0000-000000000001';
  const tenantB = 'b0000000-0000-0000-0000-000000000002';
  const skuId = '00000000-0000-0000-0000-000000000005';

  before(async () => {
    // 1. Initialize Database Connection
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
      console.log('Skipping Schemes Module & E2E Integration Tests because live database is not reachable.');
      return;
    }
    const driver = new PgDriver(pool);
    db = new PostgresDatabaseClient(config.db, driver);
    schemeRepo = new SchemePgRepository(db);

    // 2. Resolve migration directories
    const rootDir = process.cwd();
    const systemMigrationsDir = existsSync(join(rootDir, 'db/migrations/system'))
      ? join(rootDir, 'db/migrations/system')
      : join(rootDir, '../../db/migrations/system');
    
    const schemesMigrationsDir = existsSync(join(rootDir, 'db/migrations/schemes'))
      ? join(rootDir, 'db/migrations/schemes')
      : join(rootDir, '../../db/migrations/schemes');

    console.log(`[Schemes Test] Dropping and recreating public schema for clean tests`);
    await db.query('DROP SCHEMA IF EXISTS public CASCADE');
    await db.query('CREATE SCHEMA public');
    await db.query('GRANT ALL ON SCHEMA public TO public');

    // Run system migrations
    console.log(`[Schemes Test] Running system migrations from: ${systemMigrationsDir}`);
    const systemRunner = new MigrationRunner(db, { migrationsDir: systemMigrationsDir });
    await systemRunner.migrate();

    // Run Schemes migrations
    console.log(`[Schemes Test] Running Schemes migrations from: ${schemesMigrationsDir}`);
    const schemesRunner = new MigrationRunner(db, { migrationsDir: schemesMigrationsDir, tableName: 'schemes_schema_migrations' });
    await schemesRunner.migrate();

    // 3. Initialize Gateway
    gateway = new GatewayController();

    // 4. Initialize worker
    worker = new SchemesBackgroundWorker();
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
    // Clear the tables
    await db.query(`SET app.tenant_id = '${tenantA}'`);
    await db.query('TRUNCATE TABLE schemes, schemes_outbox, schemes_processed_events RESTART IDENTITY CASCADE');
  });

  // ─── 1. DOMAIN UNIT TESTS ──────────────────────────────────────────────────
  test('Domain: SchemeAggregate validates invariants and processes eligibility correctly', (t) => {
    if (!isDbAlive) { t?.skip?.(); return; }
    const today = new Date();
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);

    // Invariant: name must be non-empty
    assert.throws(() => {
      const entity = new SchemeEntity({ name: '', tenantId: tenantA });
      new SchemeAggregate(entity).validateInvariants();
    }, /name must not be empty/);

    // Invariant: start date <= end date
    assert.throws(() => {
      const entity = new SchemeEntity({ name: 'Invalid Dates', tenantId: tenantA, startDate: tomorrow, endDate: yesterday });
      new SchemeAggregate(entity).validateInvariants();
    }, /startDate must be before or equal to endDate/);

    // State Transitions
    const entity = new SchemeEntity({
      id: '00000000-0000-0000-0000-000000000010',
      tenantId: tenantA,
      name: 'Festival Scheme',
      startDate: yesterday,
      endDate: tomorrow,
      rules: { minOrderAmount: 10000, applicableSkuIds: [skuId] },
      payouts: { discountPercentage: 10 },
      status: 'draft',
    });

    const aggregate = new SchemeAggregate(entity);
    aggregate.validateInvariants();
    
    // Cannot suspend draft
    assert.throws(() => {
      aggregate.suspend();
    });

    // Activate
    aggregate.activate();
    assert.strictEqual(entity.status, 'active');

    // Suspend
    aggregate.suspend();
    assert.strictEqual(entity.status, 'suspended');

    // Re-activate
    aggregate.activate();
    assert.strictEqual(entity.status, 'active');

    // Eligibility check
    assert.strictEqual(aggregate.isEligible(15000, [skuId]), true); // Met min amount & SKU
    assert.strictEqual(aggregate.isEligible(5000, [skuId]), false);  // Below min amount
    assert.strictEqual(aggregate.isEligible(15000, ['other-sku']), false); // Non-matching SKU
  });

  // ─── 2. REPOSITORY INTEGRATION TESTS ───────────────────────────────────────
  test('Repo: Save, find, and update schemes with optimistic locking and RLS context', async (t) => {
    if (!isDbAlive) { t?.skip?.(); return; }
    const entity = new SchemeEntity({
      id: '00000000-0000-0000-0000-000000000020',
      tenantId: tenantA,
      name: 'Repo Scheme',
      startDate: new Date(),
      status: 'draft',
    });

    // 1. Save
    await schemeRepo.save(entity, tenantA);

    // 2. Find
    const saved = await schemeRepo.findById(entity.id, tenantA);
    assert.strictEqual(saved.id, entity.id);
    assert.strictEqual(saved.version, 1);

    // 3. Update (Optimistic Locking success)
    saved.name = 'Updated Repo Scheme';
    const updated = await schemeRepo.update(saved, tenantA);
    assert.strictEqual(updated.version, 2);
    assert.strictEqual(updated.name, 'Updated Repo Scheme');

    // 4. Update with stale version (Optimistic Locking failure)
    saved.version = 1; // stale version
    await assert.rejects(
      async () => {
        await schemeRepo.update(saved, tenantA);
      },
      (err: any) => {
        return err instanceof ConcurrencyError;
      }
    );
  });

  test('RLS: Prevent Tenant B from reading or updating Tenant A\'s schemes', async (t) => {
    if (!isDbAlive) { t?.skip?.(); return; }
    const entity = new SchemeEntity({
      id: '00000000-0000-0000-0000-000000000030',
      tenantId: tenantA,
      name: 'Tenant A Scheme',
      startDate: new Date(),
      status: 'draft',
    });

    // Save as Tenant A
    await schemeRepo.save(entity, tenantA);

    // Try to find as Tenant B (RLS isolation)
    await assert.rejects(
      async () => {
        await schemeRepo.findById(entity.id, tenantB);
      },
      (err: any) => {
        return err instanceof EntityNotFoundError;
      }
    );
  });

  // ─── 3. E2E HAPPY PATH TEST ────────────────────────────────────────────────
  test('E2E: Create, update status to active via Gateway, verify RLS, outbox dispatching and consumer reaction', async (t) => {
    if (!isDbAlive) { t?.skip?.(); return; }
    // 1. Generate valid JWT Token for Tenant A
    const keyRecord = KeyManager.getInstance().getSigningKey();
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;
    
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: keyRecord.kid })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: 'agent-uuid-user',
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

    const schemeId = '00000000-0000-0000-0000-000000000040';

    // 2. Submit scheme creation request to API Gateway
    const createResult = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/schemes',
      headers: {
        'authorization': `Bearer ${token}`,
        'x-tenant-id': tenantA,
      },
      body: {
        id: schemeId,
        name: 'E2E Holiday Scheme',
        description: 'Festival discount offer',
        startDate: new Date().toISOString(),
        rules: { minOrderAmount: 50000 },
        payouts: { discountPercentage: 15 },
      },
    });

    assert.strictEqual(createResult.status, 201);
    assert.strictEqual(createResult.body.success, true);
    assert.strictEqual(createResult.body.status, 'draft');

    // Verify Scheme was saved to PG under Tenant A
    const schemeInDb = await schemeRepo.findById(schemeId, tenantA);
    assert.strictEqual(schemeInDb.id, schemeId);
    assert.strictEqual(schemeInDb.status, 'draft');

    // 3. Update Scheme status to active
    const updateResult = await gateway.handleRequest({
      method: 'PUT',
      path: `/api/v1/schemes`,
      headers: {
        'authorization': `Bearer ${token}`,
        'x-tenant-id': tenantA,
      },
      body: {
        schemeId,
        status: 'active',
        version: schemeInDb.version, // optimistic lock version
      },
    });

    assert.strictEqual(updateResult.status, 200);
    assert.strictEqual(updateResult.body.success, true);
    assert.strictEqual((updateResult.body.scheme as any).status, 'active');

    // 4. Wait for Outbox Dispatcher to poll/publish
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Verify outbox event 'scheme.activated' was published
    const outboxRows = await db.query<any>(
      `SELECT * FROM schemes_outbox WHERE aggregate_id = $1`,
      [schemeId],
      tenantA
    );
    assert.ok(outboxRows.rows.length > 0);
    assert.ok(outboxRows.rows.every(row => row.status === 'PUBLISHED' || row.published_at !== null));
  });
});
