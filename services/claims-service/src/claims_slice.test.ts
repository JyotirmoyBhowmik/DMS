import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { createSign } from 'node:crypto';
import { PostgresDatabaseClient, PgDriver, MigrationRunner, ConcurrencyError, EntityNotFoundError } from '@dms/pkg-database';
import { loadConfigSync } from '@dms/pkg-config';
import { ClaimEntity } from './domain/entities/claim.entity.js';
import { ClaimAggregate } from './domain/aggregates/claim.aggregate.js';
import { ClaimPgRepository } from './infrastructure/database/repositories/claim.pg-repository.js';
import { GatewayController } from '../../api-gateway/src/presentation/rest/controllers/gateway.controller.js';
import { KeyManager } from '../../identity-service/src/application/usecases/key_manager.js';

const config = loadConfigSync();

describe('Claims Module & E2E Integration Tests', () => {
  let pool: Pool;
  let db: PostgresDatabaseClient;
  let claimRepo: ClaimPgRepository;
  let gateway: GatewayController;

  const tenantA = 'a0000000-0000-0000-0000-000000000001';
  const tenantB = 'b0000000-0000-0000-0000-000000000002';
  const schemeId = '00000000-0000-0000-0000-000000000099';
  const distributorId = 'dist-1111-2222';

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
    claimRepo = new ClaimPgRepository(db);

    // 2. Resolve migration directories
    const rootDir = process.cwd();
    const systemMigrationsDir = existsSync(join(rootDir, 'db/migrations/system'))
      ? join(rootDir, 'db/migrations/system')
      : join(rootDir, '../../db/migrations/system');
    
    const claimsMigrationsDir = existsSync(join(rootDir, 'db/migrations/claims'))
      ? join(rootDir, 'db/migrations/claims')
      : join(rootDir, '../../db/migrations/claims');

    console.log(`[Claims Test] Dropping and recreating public schema for clean tests`);
    await db.query('DROP SCHEMA public CASCADE');
    await db.query('CREATE SCHEMA public');
    await db.query('GRANT ALL ON SCHEMA public TO public');

    // Run system migrations
    console.log(`[Claims Test] Running system migrations from: ${systemMigrationsDir}`);
    const systemRunner = new MigrationRunner(db, { migrationsDir: systemMigrationsDir });
    await systemRunner.migrate();

    // Run Claims migrations
    console.log(`[Claims Test] Running Claims migrations from: ${claimsMigrationsDir}`);
    const claimsRunner = new MigrationRunner(db, { migrationsDir: claimsMigrationsDir, tableName: 'claims_schema_migrations' });
    await claimsRunner.migrate();

    // 3. Initialize Gateway
    gateway = new GatewayController();
  });

  after(async () => {
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
    await db.query('TRUNCATE TABLE claims, claims_audit_history, claims_outbox RESTART IDENTITY CASCADE');
  });

  // ─── 1. DOMAIN UNIT TESTS ──────────────────────────────────────────────────
  test('Domain: ClaimAggregate validates invariants, state machine transitions, and over-claim checks', () => {
    // Invariant: amount must be > 0
    assert.throws(() => {
      const entity = new ClaimEntity({
        tenantId: tenantA,
        distributorId,
        schemeId,
        claimAmount: 0,
        calculations: { claimAmount: 0, taxAmount: 0, netAmount: 0 }
      });
      new ClaimAggregate(entity).validateInvariants();
    }, /Claim amount must be greater than zero/);

    // Invariant: tax amount cannot be negative
    assert.throws(() => {
      const entity = new ClaimEntity({
        tenantId: tenantA,
        distributorId,
        schemeId,
        claimAmount: 100,
        calculations: { claimAmount: 100, taxAmount: -5, netAmount: 105 }
      });
      new ClaimAggregate(entity).validateInvariants();
    }, /Tax amount cannot be negative/);

    // Draft State Transitions
    const entity = new ClaimEntity({
      id: '00000000-0000-0000-0000-000000000100',
      tenantId: tenantA,
      distributorId,
      schemeId,
      claimAmount: 5000,
      calculations: { claimAmount: 5000, taxAmount: 900, netAmount: 5900 },
      status: 'draft',
    });

    const aggregate = new ClaimAggregate(entity);
    aggregate.validateInvariants();

    // Cannot approve/reject/settle in draft
    assert.throws(() => aggregate.approve('Approver User'));
    assert.throws(() => aggregate.reject('Rejecter User', 'Reason'));
    assert.throws(() => aggregate.settle('settle-key-1', 5000));

    // Move to validated
    aggregate.validate('Validator User');
    assert.strictEqual(entity.status, 'validated');
    assert.strictEqual(entity.validatedBy, 'Validator User');
    assert.ok(entity.validatedAt !== null);

    // Validate cannot be validated again
    assert.throws(() => aggregate.validate('Validator User 2'));

    // Reject from validated
    aggregate.reject('Rejecter User', 'Exceeds budget limits');
    assert.strictEqual(entity.status, 'rejected');
    assert.strictEqual(entity.rejectionReason, 'Exceeds budget limits');

    // Test approved and settle flow on a fresh aggregate
    const entity2 = new ClaimEntity({
      id: '00000000-0000-0000-0000-000000000200',
      tenantId: tenantA,
      distributorId,
      schemeId,
      claimAmount: 5000,
      calculations: { claimAmount: 5000, taxAmount: 900, netAmount: 5900 },
      status: 'validated',
    });
    const aggregate2 = new ClaimAggregate(entity2);
    
    // Approve
    aggregate2.approve('Approver User');
    assert.strictEqual(entity2.status, 'approved');
    assert.strictEqual(entity2.approvedBy, 'Approver User');
    
    // Settle (Full Settlement)
    aggregate2.settle('settle-key-1', 5900);
    assert.strictEqual(entity2.status, 'settled');
    assert.strictEqual(entity2.settlementDetails?.status, 'COMPLETED');
    assert.strictEqual(entity2.settlementDetails?.amountPaid, 5900);
    assert.strictEqual(entity2.settlementDetails?.idempotencyKey, 'settle-key-1');
  });

  // ─── 2. REPOSITORY INTEGRATION TESTS ───────────────────────────────────────
  test('Repo: Save, find, update claims, audit log creation, and optimistic locking', async () => {
    const entity = new ClaimEntity({
      id: '00000000-0000-0000-0000-000000000300',
      tenantId: tenantA,
      distributorId,
      schemeId,
      claimAmount: 12000,
      calculations: { claimAmount: 12000, taxAmount: 2160, netAmount: 14160 },
      status: 'draft',
    });

    // 1. Save
    await claimRepo.save(entity, tenantA);

    // 2. Find
    const saved = await claimRepo.findById(entity.id, tenantA);
    assert.strictEqual(saved.id, entity.id);
    assert.strictEqual(saved.version, 1);

    // 3. Update (Optimistic Locking success)
    saved.status = 'validated';
    saved.validatedBy = 'Validator User';
    saved.validatedAt = new Date();
    const updated = await claimRepo.update(saved, tenantA);
    assert.strictEqual(updated.version, 2);
    assert.strictEqual(updated.status, 'validated');

    // 4. Update with stale version (Optimistic Locking failure)
    saved.version = 1; // stale version
    await assert.rejects(
      async () => {
        await claimRepo.update(saved, tenantA);
      },
      (err: any) => {
        return err instanceof ConcurrencyError;
      }
    );

    // 5. Verify RLS Isolation
    await assert.rejects(
      async () => {
        await claimRepo.findById(entity.id, tenantB);
      },
      (err: any) => {
        return err instanceof EntityNotFoundError;
      }
    );
  });

  // ─── 3. E2E HAPPY PATH / API GATEWAY TEST ──────────────────────────────────
  test('E2E: Full lifecycle via API Gateway, concurrency guard, and audit history check', async () => {
    // Generate JWT Token for Tenant A
    const keyRecord = KeyManager.getInstance().getSigningKey();
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;
    
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: keyRecord.kid })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: 'distributor-user-uuid',
      email: 'distributor@distributor.com',
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

    const claimId = '00000000-0000-0000-0000-000000000400';

    // 1. POST /api/v1/claims (Raise Claim)
    const createResult = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/claims',
      headers: {
        'authorization': `Bearer ${token}`,
        'x-tenant-id': tenantA,
      },
      body: {
        id: claimId,
        distributorId,
        schemeId,
        claimAmount: 8500,
        calculations: { claimAmount: 8500, taxAmount: 1530, netAmount: 10030 },
      },
    });

    assert.strictEqual(createResult.status, 201);
    assert.strictEqual(createResult.body.success, true);
    assert.strictEqual((createResult.body.claim as any).status, 'draft');

    // 2. POST /api/v1/claims/:id/validate
    const validateResult = await gateway.handleRequest({
      method: 'POST',
      path: `/api/v1/claims/${claimId}/validate`,
      headers: {
        'authorization': `Bearer ${token}`,
        'x-tenant-id': tenantA,
      },
      body: {},
    });

    assert.strictEqual(validateResult.status, 200);
    assert.strictEqual(validateResult.body.success, true);
    assert.strictEqual((validateResult.body.claim as any).status, 'validated');

    // 3. POST /api/v1/claims/:id/approve
    const approveResult = await gateway.handleRequest({
      method: 'POST',
      path: `/api/v1/claims/${claimId}/approve`,
      headers: {
        'authorization': `Bearer ${token}`,
        'x-tenant-id': tenantA,
      },
      body: {},
    });

    assert.strictEqual(approveResult.status, 200);
    assert.strictEqual(approveResult.body.success, true);
    assert.strictEqual((approveResult.body.claim as any).status, 'approved');

    // 4. POST /api/v1/claims/:id/settle
    const settleResult = await gateway.handleRequest({
      method: 'POST',
      path: `/api/v1/claims/${claimId}/settle`,
      headers: {
        'authorization': `Bearer ${token}`,
        'x-tenant-id': tenantA,
      },
      body: {
        idempotencyKey: 'settle-happy-path-123',
        amountPaid: 10030,
      },
    });

    assert.strictEqual(settleResult.status, 200);
    assert.strictEqual(settleResult.body.success, true);
    assert.strictEqual((settleResult.body.claim as any).status, 'settled');

    // 5. Test Idempotency (Repeat settle request with same key)
    const settleRepeatResult = await gateway.handleRequest({
      method: 'POST',
      path: `/api/v1/claims/${claimId}/settle`,
      headers: {
        'authorization': `Bearer ${token}`,
        'x-tenant-id': tenantA,
      },
      body: {
        idempotencyKey: 'settle-happy-path-123',
        amountPaid: 10030,
      },
    });

    assert.strictEqual(settleRepeatResult.status, 200);
    assert.strictEqual(settleRepeatResult.body.success, true);
    assert.strictEqual((settleRepeatResult.body.claim as any).status, 'settled');

    // 6. Verify Audit Trail and Outbox logs in the DB
    const auditRows = await db.query<any>(
      `SELECT * FROM claims_audit_history WHERE claim_id = $1 ORDER BY created_at ASC`,
      [claimId],
      tenantA
    );
    assert.strictEqual(auditRows.rows.length, 4); // RAISED, VALIDATED, APPROVED, SETTLED
    assert.strictEqual(auditRows.rows[0].action, 'RAISED');
    assert.strictEqual(auditRows.rows[3].action, 'SETTLED');

    const outboxRows = await db.query<any>(
      `SELECT * FROM claims_outbox WHERE aggregate_id = $1`,
      [claimId],
      tenantA
    );
    assert.strictEqual(outboxRows.rows.length, 4);
    assert.strictEqual(outboxRows.rows[0].event_type, 'claim.raised');
    assert.strictEqual(outboxRows.rows[3].event_type, 'claim.settled');
  });
});
