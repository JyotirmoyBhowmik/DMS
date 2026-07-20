import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { MerchandisingAudit } from './domain/entities/merchandising-audit.js';
import { Money } from './domain/value-objects/money.js';
import { InvalidAuditStateError } from './domain/errors/domain-error.js';
import { MerchandisingAuditPgRepository } from './infrastructure/database/repositories/merchandising-audit.pg-repository.js';
import { CreateMerchandisingAuditUseCase } from './application/usecases/merchandising-audit/create-merchandising-audit.usecase.js';
import { GetMerchandisingAuditUseCase } from './application/usecases/merchandising-audit/get-merchandising-audit.usecase.js';
import { UpdateMerchandisingAuditUseCase } from './application/usecases/merchandising-audit/update-merchandising-audit.usecase.js';
import { ListMerchandisingAuditsUseCase } from './application/usecases/merchandising-audit/list-merchandising-audits.usecase.js';
import { AuditController } from '../../../services/audit-service/src/presentation/rest/controllers/audit.controller.js';
import { Principal } from '@dms/pkg-rbac';

describe('MerchandisingAudit Domain & Lifecycle State Machine', () => {
  const validProps = {
    id: randomUUID(),
    tenantId: randomUUID(),
    agentId: randomUUID(),
    outletId: randomUUID(),
    auditDate: '2026-07-19',
    shelfPhotos: [{ photoUrl: 'http://img.com/1.png', category: 'shelf', timestamp: new Date() }],
    planogramCompliance: 85,
    shelfShareByBrand: [{ brand: 'Coca-Cola', percentage: 40 }, { brand: 'Pepsi', percentage: 30 }],
    outOfStockSkus: ['sku-101'],
    pricingAudit: [{ skuId: 'sku-101', listedPrice: Money.fromCents(120), actualPrice: Money.fromCents(120) }],
    displayScore: 90,
  };

  test('should successfully construct and validate invariants', () => {
    const audit = MerchandisingAudit.create(validProps);
    assert.strictEqual(audit.planogramCompliance, 85);
    assert.strictEqual(audit.displayScore, 90);
    assert.strictEqual(audit.status, 'DRAFT');
  });

  test('should reject invalid compliance and display scores', () => {
    assert.throws(() => {
      MerchandisingAudit.create({ ...validProps, planogramCompliance: 105 });
    }, /Planogram compliance must be 0-100/);

    assert.throws(() => {
      MerchandisingAudit.create({ ...validProps, displayScore: -5 });
    }, /Display score must be 0-100/);
  });

  test('should reject brand shelf share sum exceeding 100%', () => {
    assert.throws(() => {
      MerchandisingAudit.create({
        ...validProps,
        shelfShareByBrand: [
          { brand: 'Coca-Cola', percentage: 60 },
          { brand: 'Pepsi', percentage: 50 },
        ],
      });
    }, /Total shelf share percentage cannot exceed 100%/);
  });

  test('should enforce state transitions flow DRAFT -> SUBMITTED -> APPROVED', () => {
    const audit = MerchandisingAudit.create(validProps);
    assert.strictEqual(audit.status, 'DRAFT');

    audit.submit();
    assert.strictEqual(audit.status, 'SUBMITTED');

    audit.approve();
    assert.strictEqual(audit.status, 'APPROVED');

    // Trying to transition from APPROVED -> REJECTED must fail
    assert.throws(() => {
      audit.reject('Incorrect photo');
    }, InvalidAuditStateError);
  });

  test('should reject transitions from SUBMITTED to REJECTED without reason', () => {
    const audit = MerchandisingAudit.create(validProps);
    audit.submit();
    assert.throws(() => {
      audit.reject('');
    }, /Rejection reason is required/);
  });
});

describe('MerchandisingAudit Repository Fallback Persistence', () => {
  const tenantId = randomUUID();
  const repo = new MerchandisingAuditPgRepository();

  beforeEach(() => {
    MerchandisingAuditPgRepository.clearStore();
  });

  test('should persist and retrieve audits using fallback cache', async () => {
    const audit = MerchandisingAudit.create({
      id: randomUUID(),
      tenantId,
      agentId: randomUUID(),
      outletId: randomUUID(),
      auditDate: '2026-07-19',
    });

    await repo.save(audit);

    const found = await repo.findById(audit.id, tenantId);
    assert.ok(found);
    assert.strictEqual(found.id, audit.id);

    const nonExistent = await repo.findById(randomUUID(), tenantId);
    assert.strictEqual(nonExistent, null);
  });
});

describe('MerchandisingAudit Use Cases Integration', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const agentPrincipal: Principal = { id: 'agent-123', tenantId, roles: ['agent'] };
  const adminPrincipal: Principal = { id: 'admin-999', tenantId, roles: ['admin'] };
  const roguePrincipal: Principal = { id: 'rogue-321', tenantId: randomUUID(), roles: ['agent'] };

  const dbRepo = new MerchandisingAuditPgRepository();
  const createUseCase = new CreateMerchandisingAuditUseCase(undefined, dbRepo);
  const getUseCase = new GetMerchandisingAuditUseCase(undefined, dbRepo);
  const updateUseCase = new UpdateMerchandisingAuditUseCase(undefined, dbRepo);
  const listUseCase = new ListMerchandisingAuditsUseCase(undefined, dbRepo);

  const defaultDto = {
    tenantId,
    agentId: 'agent-123',
    outletId: randomUUID(),
    auditDate: '2026-07-19',
    shelfPhotos: [],
    planogramCompliance: 90,
    shelfShareByBrand: [],
    outOfStockSkus: [],
    pricingAudit: [{ skuId: 'sku-1', listedPrice: 100, actualPrice: 120 }], // listed 1.00, actual 1.20
    displayScore: 90,
  };

  beforeEach(() => {
    MerchandisingAuditPgRepository.clearStore();
    AuditController.getInstance().getRepository().clear();
  });

  test('should deny create for wrong tenant principal', async () => {
    await assert.rejects(
      createUseCase.execute(roguePrincipal, defaultDto),
      /Forbidden: Tenant context mismatch/
    );
  });

  test('should successfully create, record ledger block, and enforce idempotency', async () => {
    const auditId = randomUUID();
    const result = await createUseCase.execute(agentPrincipal, { ...defaultDto, id: auditId });
    assert.strictEqual(result.id, auditId);
    assert.strictEqual(result.status, 'DRAFT');

    // Verify cryptographic audit logging
    const auditRepo = AuditController.getInstance().getRepository();
    const blocks = await auditRepo.getAllBlocks();
    const createBlock = blocks.find((b: any) => b.data && b.data.type === 'merchandising_audit.created');
    assert.ok(createBlock);
    assert.strictEqual(createBlock.data.actor, 'agent-123');

    // Idempotency: submitting the same audit (same agent, outlet and date) again returns the existing one
    const secondResult = await createUseCase.execute(agentPrincipal, {
      ...defaultDto,
      outletId: defaultDto.outletId,
      auditDate: defaultDto.auditDate,
    });
    assert.strictEqual(secondResult.id, auditId);
  });

  test('should restrict read by tenant context scoping', async () => {
    const audit = await createUseCase.execute(agentPrincipal, defaultDto);
    // 1. Tenant context mismatch: principal tenant != query tenant
    await assert.rejects(
      getUseCase.execute(roguePrincipal, audit.id, tenantId),
      /Forbidden: Tenant context mismatch/
    );

    // 2. Resource hiding: rogue agent requests with their own tenant context, returning not found (RLS tenant isolation)
    await assert.rejects(
      getUseCase.execute(roguePrincipal, audit.id, roguePrincipal.tenantId),
      /not found/
    );

    const fetched = await getUseCase.execute(agentPrincipal, audit.id, tenantId);
    assert.strictEqual(fetched.id, audit.id);
  });

  test('should restrict update/approval operations to matching permission context', async () => {
    const audit = await createUseCase.execute(agentPrincipal, defaultDto);

    // Standard update (adding photos) should work for agent
    const updated = await updateUseCase.execute(agentPrincipal, audit.id, tenantId, {
      notes: 'New notes',
      version: 0,
    });
    assert.strictEqual(updated.notes, 'New notes');
    assert.strictEqual(updated.version, 1);

    // Agent attempts to directly transition to APPROVED - fails due to missing approve permission
    await assert.rejects(
      updateUseCase.execute(agentPrincipal, audit.id, tenantId, {
        status: 'APPROVED',
        version: 1,
      }),
      /Forbidden: Insufficient permissions, missing merchandising_audit:approve/
    );

    // Agent submits the audit
    const submitted = await updateUseCase.execute(agentPrincipal, audit.id, tenantId, {
      status: 'SUBMITTED',
      version: 1,
    });
    assert.strictEqual(submitted.status, 'SUBMITTED');

    // Admin approves the audit successfully
    const approved = await updateUseCase.execute(adminPrincipal, audit.id, tenantId, {
      status: 'APPROVED',
      version: 2,
    });
    assert.strictEqual(approved.status, 'APPROVED');

    // Verify audit logs contain updates
    const auditRepo = AuditController.getInstance().getRepository();
    const blocks = await auditRepo.getAllBlocks();
    const updateBlocks = blocks.filter((b: any) => b.data && b.data.type === 'merchandising_audit.updated');
    assert.strictEqual(updateBlocks.length, 3); // 1 notes update, 1 submit, 1 approval
  });

  test('should reject update if version mismatch (optimistic concurrency error)', async () => {
    const audit = await createUseCase.execute(agentPrincipal, defaultDto);

    await assert.rejects(
      updateUseCase.execute(agentPrincipal, audit.id, tenantId, {
        notes: 'Notes v2',
        version: 5, // mismatch, should be 0
      }),
      /Optimistic locking conflict/
    );
  });

  test('should list and filter audits scoping to pagination caps', async () => {
    const outlet1 = randomUUID();
    const outlet2 = randomUUID();

    await createUseCase.execute(agentPrincipal, { ...defaultDto, outletId: outlet1, auditDate: '2026-07-18' });
    await createUseCase.execute(agentPrincipal, { ...defaultDto, outletId: outlet2, auditDate: '2026-07-19' });

    const listRes = await listUseCase.execute(agentPrincipal, tenantId, { pageSize: 50 });
    assert.strictEqual(listRes.total, 2);
    assert.strictEqual(listRes.pageSize, 50);

    const filtered = await listUseCase.execute(agentPrincipal, tenantId, { outletId: outlet1 });
    assert.strictEqual(filtered.total, 1);
    assert.strictEqual(filtered.data[0].outletId, outlet1);
  });
});
