import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { createSign } from 'node:crypto';
import { PostgresDatabaseClient, PgDriver, MigrationRunner, ConcurrencyError, EntityNotFoundError } from '@dms/pkg-database';
import { loadConfigSync } from '@dms/pkg-config';
import { makeEnvelope, MessageBrokerClient } from '@dms/pkg-events';

import { DistributorOnboardingWorkflow } from './domain/entities/distributor-onboarding.js';
import { KYCDocument } from './domain/entities/kyc-document.js';
import { DistributorHierarchy } from './domain/entities/distributor-hierarchy.js';
import { CreditLimit } from './domain/entities/credit-limit.js';
import { Distributor } from './domain/entities/distributor.js';

import { DistributorOnboardingPgRepository } from './infrastructure/database/repositories/distributor-onboarding.pg-repository.js';
import { KYCDocumentPgRepository } from './infrastructure/database/repositories/kyc-document.pg-repository.js';
import { CreditLimitPgRepository } from './infrastructure/database/repositories/credit-limit.pg-repository.js';
import { DistributorHierarchyPgRepository } from './infrastructure/database/repositories/distributor-hierarchy.pg-repository.js';
import { DistributorPgRepository } from './infrastructure/database/repositories/distributor.pg-repository.js';

import { GatewayController } from '../../api-gateway/src/presentation/rest/controllers/gateway.controller.js';
import { DmsCoreBackgroundWorker } from './worker.js';
import { KeyManager } from '../../identity-service/src/application/usecases/key_manager.js';
import { EventConsumer } from './presentation/events/event_consumer.js';

const config = loadConfigSync();

describe('DMS Distributor Lifecycle Module & E2E Integration Tests', () => {
  let pool: Pool;
  let db: PostgresDatabaseClient;
  
  let onboardingRepo: DistributorOnboardingPgRepository;
  let kycRepo: KYCDocumentPgRepository;
  let creditLimitRepo: CreditLimitPgRepository;
  let hierarchyRepo: DistributorHierarchyPgRepository;
  let distributorRepo: DistributorPgRepository;
  
  let worker: DmsCoreBackgroundWorker;
  let gateway: GatewayController;

  const tenantA = 'a0000000-0000-0000-0000-000000000001';
  const tenantB = 'b0000000-0000-0000-0000-000000000002';
  const distributorIdA = 'a0000000-0000-0000-0000-000000000010';
  const distributorIdB = 'b0000000-0000-0000-0000-000000000020';
  const verifierId = '00000000-0000-0000-0000-000000000009';

  before(async () => {
    // 1. Initialize DB Connection
    pool = new Pool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
    });
    const driver = new PgDriver(pool);
    db = new PostgresDatabaseClient(config.db, driver);

    onboardingRepo = new DistributorOnboardingPgRepository(db);
    kycRepo = new KYCDocumentPgRepository(db);
    creditLimitRepo = new CreditLimitPgRepository(db);
    hierarchyRepo = new DistributorHierarchyPgRepository(db);
    distributorRepo = new DistributorPgRepository(db);

    // 2. Resolve migration directories
    const rootDir = process.cwd();
    const systemMigrationsDir = existsSync(join(rootDir, 'db/migrations/system/V001__create_system_tables.sql'))
      ? join(rootDir, 'db/migrations/system')
      : join(rootDir, '../../db/migrations/system');
    
    const dmsMigrationsDir = existsSync(join(rootDir, 'db/migrations/dms/V001__create_dms_tables.sql'))
      ? join(rootDir, 'db/migrations/dms')
      : join(rootDir, '../../db/migrations/dms');

    console.log(`[DMS Test] Dropping and recreating public schema for clean tests`);
    await db.query('DROP SCHEMA public CASCADE');
    await db.query('CREATE SCHEMA public');
    await db.query('GRANT ALL ON SCHEMA public TO public');

    // Run system migrations
    console.log(`[DMS Test] Running system migrations from: ${systemMigrationsDir}`);
    const systemRunner = new MigrationRunner(db, { migrationsDir: systemMigrationsDir });
    await systemRunner.migrate();

    // Run DMS migrations
    console.log(`[DMS Test] Running DMS migrations from: ${dmsMigrationsDir}`);
    const dmsRunner = new MigrationRunner(db, { migrationsDir: dmsMigrationsDir, tableName: 'dms_schema_migrations' });
    await dmsRunner.migrate();

    // 3. Initialize Gateway & Background Worker
    gateway = new GatewayController();
    worker = new DmsCoreBackgroundWorker();
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
    // Clear tables
    await db.query(`SET app.tenant_id = '${tenantA}'`);
    await db.query(
      'TRUNCATE TABLE distributors, distributor_onboarding_workflows, kyc_documents, credit_limits, distributor_hierarchy, dms_outbox, dms_processed_events RESTART IDENTITY CASCADE'
    );
  });

  // ─── 1. DOMAIN UNIT TESTS ──────────────────────────────────────────────────
  test('Domain: DistributorOnboardingWorkflow transitions and events', () => {
    const workflow = DistributorOnboardingWorkflow.create({
      id: '00000000-0000-0000-0000-000000000100',
      tenantId: tenantA,
      distributorId: distributorIdA,
    });
    assert.strictEqual(workflow.currentStage, 'DRAFT');
    assert.strictEqual(workflow.domainEvents.length, 1);
    assert.strictEqual(workflow.domainEvents[0].type, 'distributor.onboarding.created');

    workflow.submitForKYC();
    assert.strictEqual(workflow.currentStage, 'KYC_PENDING');
    assert.strictEqual(workflow.domainEvents[1].type, 'distributor.onboarding.stage_updated');

    workflow.approveKYC();
    assert.strictEqual(workflow.currentStage, 'CREDIT_CHECK');

    workflow.approveCreditCheck();
    assert.strictEqual(workflow.currentStage, 'CONTRACT_SIGNATURE');

    workflow.signContract();
    assert.strictEqual(workflow.contractSigned, true);

    workflow.activate(verifierId);
    assert.strictEqual(workflow.currentStage, 'ACTIVE');
    assert.strictEqual(workflow.approvedBy, verifierId);
  });

  test('Domain: DistributorHierarchy invariants and depth checks', () => {
    // Invariant: no self-reference
    assert.throws(() => {
      DistributorHierarchy.create({
        id: 'h-1',
        tenantId: tenantA,
        parentDistributorId: distributorIdA,
        childDistributorId: distributorIdA,
        hierarchyLevel: 'DISTRIBUTOR',
        effectiveFrom: '2026-06-01',
        territory: 'Delhi',
      });
    }, /cannot be its own parent/);

    // Level rank check: parent level CNF(2) must be higher than child level SUPER_STOCKIST(1) -> should fail
    assert.throws(() => {
      DistributorHierarchy.validateParentLevel('CNF', 'SUPER_STOCKIST');
    }, /must be higher than child level/);

    // Max depth check
    assert.throws(() => {
      DistributorHierarchy.validateMaxDepth(3); // depth is 3 + 1 = 4, which is limit (exceeded if >= 4)
    }, /Maximum hierarchy depth/);

    // Circular dependency detection
    assert.throws(() => {
      DistributorHierarchy.detectCircular('child-id', ['child-id', 'parent-id']);
    }, /Circular hierarchy detected/);
  });

  test('Domain: CreditLimit utilization and validation rules', () => {
    const cl = CreditLimit.create({
      id: 'cl-1',
      tenantId: tenantA,
      distributorId: distributorIdA,
      creditLimit: 5000000, // $50,000.00
    });
    assert.strictEqual(cl.availableAmount, 5000000);
    assert.strictEqual(cl.isOnCreditHold, false);

    cl.utilize(1000000);
    assert.strictEqual(cl.utilizedAmount, 1000000);
    assert.strictEqual(cl.availableAmount, 4000000);

    // utilized = 4.6M / 5M = 92% -> credit hold triggers at > 90%
    cl.utilize(3600000);
    assert.strictEqual(cl.isOnCreditHold, true);

    // Exceeding available limit
    assert.throws(() => {
      cl.utilize(1000000);
    }, /Insufficient credit/);
  });

  // ─── 2. REPOSITORY & RLS INTEGRATION TESTS ───────────────────────────────
  test('Repo: Onboarding & KYC Postgres operations with versioning and RLS', async () => {
    // Pre-requisite: Seed distributors in DB
    const distA = Distributor.create({ id: distributorIdA, tenantId: tenantA, name: 'Dist A', region: 'North', creditLimit: 100000 });
    const distB = Distributor.create({ id: distributorIdB, tenantId: tenantB, name: 'Dist B', region: 'South', creditLimit: 200000 });
    await distributorRepo.save(distA, tenantA);
    await distributorRepo.save(distB, tenantB);

    // 1. Onboarding pg-repository save & findById
    const workflow = new DistributorOnboardingWorkflow(
      '00000000-0000-0000-0000-000000000110',
      tenantA,
      distributorIdA,
      'DRAFT',
      'PENDING',
      'PENDING',
      false,
      null,
      1
    );
    await onboardingRepo.save(workflow);

    const savedWorkflow = await onboardingRepo.findById(workflow.id, tenantA);
    assert.ok(savedWorkflow);
    assert.strictEqual(savedWorkflow.distributorId, distributorIdA);

    // 2. KYC document pg-repository saving and RLS isolation
    const doc = new KYCDocument({
      id: '00000000-0000-0000-0000-000000000120',
      tenantId: tenantA,
      distributorId: distributorIdA,
      documentType: 'GSTIN',
      documentNumber: '07AAAAA1111A1Z1',
      verificationStatus: 'PENDING',
    });
    await kycRepo.save(doc);

    // Read as Tenant A should succeed
    const docA = await kycRepo.findById(tenantA, doc.id);
    assert.ok(docA);
    assert.strictEqual(docA.documentNumber, '07AAAAA1111A1Z1');

    // Read as Tenant B should fail (returns null due to RLS constraint)
    const docB = await kycRepo.findById(tenantB, doc.id);
    assert.strictEqual(docB, null);
  });

  // ─── 3. E2E STACK INTEGRATION TESTS ────────────────────────────────────────
  test('E2E: Full distributor lifecycle onboarding, KYC validation & credit utilization', async () => {
    // 1. Generate JWT Token
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

    const onboardHeaders = {
      'authorization': `Bearer ${token}`,
      'x-tenant-id': tenantA,
    };

    // Pre-requisites: seed distributor A
    const dist = Distributor.create({ id: distributorIdA, tenantId: tenantA, name: 'Metro Distributors', region: 'North', creditLimit: 200000 });
    await distributorRepo.save(dist, tenantA);

    const onboardingId = '00000000-0000-0000-0000-000000000200';

    // 2. HTTP POST -> Create Onboarding Workflow via Gateway
    const createRes = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/distributors/onboarding',
      headers: onboardHeaders,
      body: {
        id: onboardingId,
        distributorId: distributorIdA,
      },
    });
    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createRes.body.success, true);
    assert.strictEqual((createRes.body.workflow as any).currentStage, 'DRAFT');

    // 3. submit-kyc stage transition
    const submitKycRes = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/distributors/onboarding/submit-kyc',
      headers: onboardHeaders,
      body: { id: onboardingId },
    });
    assert.strictEqual(submitKycRes.status, 200);
    assert.strictEqual((submitKycRes.body.workflow as any).currentStage, 'KYC_PENDING');

    // 4. Upload GSTIN and PAN documents
    const gstId = '00000000-0000-0000-0000-000000000210';
    const panId = '00000000-0000-0000-0000-000000000220';

    const gstUpload = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/distributors/kyc',
      headers: onboardHeaders,
      body: {
        id: gstId,
        distributorId: distributorIdA,
        documentType: 'GSTIN',
        documentNumber: '07GSTIN12345Z1',
        documentUrl: 'http://docs.com/gstin.pdf',
      },
    });
    assert.strictEqual(gstUpload.status, 201);

    const panUpload = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/distributors/kyc',
      headers: onboardHeaders,
      body: {
        id: panId,
        distributorId: distributorIdA,
        documentType: 'PAN',
        documentNumber: 'ABCDE1234F',
        documentUrl: 'http://docs.com/pan.png',
      },
    });
    assert.strictEqual(panUpload.status, 201);

    // Test malware scanning validation error
    const virusUpload = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/distributors/kyc',
      headers: onboardHeaders,
      body: {
        id: '00000000-0000-0000-0000-000000000230',
        distributorId: distributorIdA,
        documentType: 'TRADE_LICENSE',
        documentNumber: 'TRADE12345',
        documentUrl: 'http://docs.com/virus-infected.pdf', // trigger malware scanning fail
      },
    });
    assert.strictEqual(virusUpload.status, 400); // Bad Request due to virus detection
    assert.match((virusUpload.body.error as string), /Malware scan failed/);

    // 5. Verify documents and auto-transition onboarding stage to CREDIT_CHECK
    const verifyGst = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/distributors/kyc/verify',
      headers: onboardHeaders,
      body: {
        id: gstId,
        verifiedBy: verifierId,
        approve: true,
      },
    });
    assert.strictEqual(verifyGst.status, 200);

    const verifyPan = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/distributors/kyc/verify',
      headers: onboardHeaders,
      body: {
        id: panId,
        verifiedBy: verifierId,
        approve: true,
      },
    });
    assert.strictEqual(verifyPan.status, 200);

    // Onboarding stage should now be auto-moved to CREDIT_CHECK because both GSTIN and PAN are verified!
    const workflowInDb = await onboardingRepo.findById(onboardingId, tenantA);
    assert.ok(workflowInDb);
    assert.strictEqual(workflowInDb.currentStage, 'CREDIT_CHECK');

    // 6. Approve credit stage
    const approveCredit = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/distributors/onboarding/approve-credit',
      headers: onboardHeaders,
      body: { id: onboardingId },
    });
    assert.strictEqual(approveCredit.status, 200);
    assert.strictEqual((approveCredit.body.workflow as any).currentStage, 'CONTRACT_SIGNATURE');

    // 7. Sign contract and activate onboarding
    const signContract = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/distributors/onboarding/sign-contract',
      headers: onboardHeaders,
      body: { id: onboardingId },
    });
    assert.strictEqual(signContract.status, 200);

    const activateWorkflow = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/distributors/onboarding/activate',
      headers: onboardHeaders,
      body: {
        id: onboardingId,
        approvedBy: verifierId,
      },
    });
    assert.strictEqual(activateWorkflow.status, 200);
    assert.strictEqual((activateWorkflow.body.workflow as any).currentStage, 'ACTIVE');

    // 8. Wait for outbox polling dispatcher to process events and push to RabbitMQ
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Check that outbox events were successfully published
    const outboxRows = await db.query<any>(
      `SELECT * FROM dms_outbox WHERE published_at IS NOT NULL`,
      [],
      tenantA
    );
    assert.ok(outboxRows.rows.length > 0);
  });

  // ─── 4. IDEMPOTENT EVENT CONSUMER DEDUPLICATION TESTS ───────────────────
  test('Idempotence: Skip processed events in database deduplication table', async () => {
    EventConsumer.clearStore();
    const consumer = new EventConsumer(db);

    const envelope = makeEnvelope(
      'order.placed',
      'v1',
      { orderId: 'ord-dedupe-1', distributorId: distributorIdA, amount: 50000 },
      { tenantId: tenantA, correlationId: 'corr-dedupe-1', producer: 'sfa-service', partitionKey: 'ord-dedupe-1' }
    );

    let handleCount = 0;
    const mockHandler = async (evt: any) => {
      handleCount++;
      assert.strictEqual(evt.payload.orderId, 'ord-dedupe-1');
    };

    // First consumption -> process and write to dms_processed_events
    const res1 = await consumer.consume(envelope, mockHandler);
    assert.strictEqual(res1.status, 'processed');
    assert.strictEqual(handleCount, 1);

    // Second consumption with same eventId -> skip
    const res2 = await consumer.consume(envelope, mockHandler);
    assert.strictEqual(res2.status, 'skipped');
    assert.strictEqual(handleCount, 1); // handler is not called again

    // Verify row exists in DB
    const dbRows = await db.query<any>(
      `SELECT * FROM dms_processed_events WHERE event_id = $1 AND tenant_id = $2`,
      [envelope.eventId, tenantA],
      tenantA
    );
    assert.strictEqual(dbRows.rows.length, 1);
  });
});
