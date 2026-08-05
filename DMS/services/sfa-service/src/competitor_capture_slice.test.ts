import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { CompetitorCapture } from './domain/entities/competitor-capture.js';
import { Money } from './domain/value-objects/money.js';
import { InvalidCompetitorCaptureStateError } from './domain/errors/domain-error.js';
import { CompetitorCapturePgRepository } from './infrastructure/database/repositories/competitor-capture.pg-repository.js';
import { CreateCompetitorCaptureUseCase } from './application/usecases/competitor-capture/create-competitor-capture.usecase.js';
import { GetCompetitorCaptureUseCase } from './application/usecases/competitor-capture/get-competitor-capture.usecase.js';
import { UpdateCompetitorCaptureUseCase } from './application/usecases/competitor-capture/update-competitor-capture.usecase.js';
import { ListCompetitorCapturesUseCase } from './application/usecases/competitor-capture/list-competitor-captures.usecase.js';
import { CompetitorCaptureController } from './presentation/rest/controllers/competitor-capture.controller.js';
import { AuditController } from '../../../services/audit-service/src/presentation/rest/controllers/audit.controller.js';
import { Principal } from '@dms/pkg-rbac';

describe('CompetitorCapture Domain & State Machine', () => {
  const validProps = {
    id: randomUUID(),
    tenantId: randomUUID(),
    agentId: randomUUID(),
    outletId: randomUUID(),
    captureDate: '2026-07-19',
    brand: 'PepsiCo',
    skuId: 'pepsi-500ml',
    observedPrice: Money.fromCents(120),
    promotionDetails: 'Buy 1 Get 1 Free',
    photoUrl: 'http://img.com/competitor1.png',
    notes: 'Located at bottom shelf',
  };

  test('should successfully construct and validate invariants', () => {
    const capture = CompetitorCapture.create(validProps);
    assert.strictEqual(capture.brand, 'PepsiCo');
    assert.strictEqual(capture.skuId, 'pepsi-500ml');
    assert.strictEqual(capture.observedPrice.cents, 120);
    assert.strictEqual(capture.status, 'DRAFT');
  });

  test('should reject invalid values', () => {
    assert.throws(() => {
      CompetitorCapture.create({ ...validProps, brand: '' });
    }, /brand cannot be empty/);

    assert.throws(() => {
      CompetitorCapture.create({ ...validProps, skuId: '  ' });
    }, /skuId cannot be empty/);

    assert.throws(() => {
      CompetitorCapture.create({ ...validProps, observedPrice: Money.fromCents(-10) });
    }, /cannot be negative/);
  });

  test('should enforce DRAFT modification only', () => {
    const capture = CompetitorCapture.create(validProps);
    capture.updatePrice(Money.fromCents(130));
    assert.strictEqual(capture.observedPrice.cents, 130);

    capture.submit();
    assert.throws(() => {
      capture.updatePrice(Money.fromCents(140));
    }, /Can only mutate competitor capture in DRAFT status/);
  });

  test('should enforce state transitions flow DRAFT -> SUBMITTED -> APPROVED', () => {
    const capture = CompetitorCapture.create(validProps);
    assert.strictEqual(capture.status, 'DRAFT');

    capture.submit();
    assert.strictEqual(capture.status, 'SUBMITTED');

    capture.approve();
    assert.strictEqual(capture.status, 'APPROVED');

    assert.throws(() => {
      capture.reject('Mistake');
    }, InvalidCompetitorCaptureStateError);
  });

  test('should require rejection reason from SUBMITTED to REJECTED', () => {
    const capture = CompetitorCapture.create(validProps);
    capture.submit();
    assert.throws(() => {
      capture.reject('');
    }, /Rejection reason is required/);
  });
});

describe('CompetitorCapture Repository Persistence', () => {
  const tenantId = randomUUID();
  const repo = new CompetitorCapturePgRepository();

  beforeEach(() => {
    CompetitorCapturePgRepository.clearStore();
  });

  test('should persist and retrieve captures using fallback cache', async () => {
    const capture = CompetitorCapture.create({
      id: randomUUID(),
      tenantId,
      agentId: randomUUID(),
      outletId: randomUUID(),
      captureDate: '2026-07-19',
      brand: 'Coke',
      skuId: 'coke-330ml',
      observedPrice: Money.fromCents(90),
    });

    await repo.save(capture);

    const found = await repo.findById(capture.id, tenantId);
    assert.ok(found);
    assert.strictEqual(found.id, capture.id);
    assert.strictEqual(found.brand, 'Coke');

    const byAgent = await repo.findByAgent(capture.agentId, tenantId);
    assert.strictEqual(byAgent.length, 1);

    const byOutlet = await repo.findByOutlet(capture.outletId, tenantId);
    assert.strictEqual(byOutlet.length, 1);

    await repo.delete(capture.id, tenantId);
    const deleted = await repo.findById(capture.id, tenantId);
    assert.strictEqual(deleted, null);
  });
});

describe('CompetitorCapture Use Cases execution', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const agentPrincipal: Principal = { id: 'agent-123', tenantId, roles: ['agent'] };
  const adminPrincipal: Principal = { id: 'admin-999', tenantId, roles: ['admin'] };
  const roguePrincipal: Principal = { id: 'rogue-321', tenantId: randomUUID(), roles: ['agent'] };

  const dbRepo = new CompetitorCapturePgRepository();
  const createUseCase = new CreateCompetitorCaptureUseCase(undefined, dbRepo);
  const getUseCase = new GetCompetitorCaptureUseCase(undefined, dbRepo);
  const updateUseCase = new UpdateCompetitorCaptureUseCase(undefined, dbRepo);
  const listUseCase = new ListCompetitorCapturesUseCase(undefined, dbRepo);

  const defaultDto = {
    tenantId,
    agentId: 'agent-123',
    outletId: randomUUID(),
    captureDate: '2026-07-19',
    brand: 'RedBull',
    skuId: 'redbull-250ml',
    observedPrice: 150,
  };

  beforeEach(() => {
    CompetitorCapturePgRepository.clearStore();
    AuditController.getInstance().getRepository().clear();
  });

  test('should deny create for unauthorized tenant principal', async () => {
    await assert.rejects(
      createUseCase.execute(roguePrincipal, defaultDto),
      /Forbidden: Tenant context mismatch/
    );
  });

  test('should successfully create, record outbox event, and enforce idempotency', async () => {
    const captureId = randomUUID();
    const result = await createUseCase.execute(agentPrincipal, { ...defaultDto, id: captureId });
    assert.strictEqual(result.id, captureId);
    assert.strictEqual(result.status, 'DRAFT');

    const auditRepo = AuditController.getInstance().getRepository();
    const blocks = await auditRepo.getAllBlocks();
    const createBlock = blocks.find((b: any) => b.data && b.data.type === 'competitor_capture.created');
    assert.ok(createBlock);
    assert.strictEqual(createBlock.data.actor, 'agent-123');

    // Idempotency: creating same capture again returns existing capture
    const secondResult = await createUseCase.execute(agentPrincipal, {
      ...defaultDto,
      outletId: defaultDto.outletId,
      captureDate: defaultDto.captureDate,
      brand: defaultDto.brand,
      skuId: defaultDto.skuId,
    });
    assert.strictEqual(secondResult.id, captureId);
  });

  test('should enforce read tenant isolation and scoping', async () => {
    const capture = await createUseCase.execute(agentPrincipal, defaultDto);
    await assert.rejects(
      getUseCase.execute(roguePrincipal, capture.id, tenantId),
      /Forbidden: Tenant context mismatch/
    );

    await assert.rejects(
      getUseCase.execute(roguePrincipal, capture.id, roguePrincipal.tenantId),
      /not found/
    );

    const fetched = await getUseCase.execute(agentPrincipal, capture.id, tenantId);
    assert.strictEqual(fetched.id, capture.id);
  });

  test('should restrict update/approval permissions context', async () => {
    const capture = await createUseCase.execute(agentPrincipal, defaultDto);

    const updated = await updateUseCase.execute(agentPrincipal, capture.id, tenantId, {
      notes: 'Updated notes',
      version: 0,
    });
    assert.strictEqual(updated.notes, 'Updated notes');
    assert.strictEqual(updated.version, 1);

    // Agent attempts to directly approve: Forbidden
    await assert.rejects(
      updateUseCase.execute(agentPrincipal, capture.id, tenantId, {
        status: 'APPROVED',
        version: 1,
      }),
      /Forbidden: Insufficient permissions, missing competitor_capture:approve/
    );

    // Agent submits
    const submitted = await updateUseCase.execute(agentPrincipal, capture.id, tenantId, {
      status: 'SUBMITTED',
      version: 1,
    });
    assert.strictEqual(submitted.status, 'SUBMITTED');

    // Admin approves
    const approved = await updateUseCase.execute(adminPrincipal, capture.id, tenantId, {
      status: 'APPROVED',
      version: 2,
    });
    assert.strictEqual(approved.status, 'APPROVED');
  });

  test('should reject update on version mismatch (optimistic locking)', async () => {
    const capture = await createUseCase.execute(agentPrincipal, defaultDto);

    await assert.rejects(
      updateUseCase.execute(agentPrincipal, capture.id, tenantId, {
        notes: 'Notes v2',
        version: 99,
      }),
      /Optimistic locking conflict/
    );
  });

  test('should search and list with pagination filters', async () => {
    const outlet1 = randomUUID();
    const outlet2 = randomUUID();

    await createUseCase.execute(agentPrincipal, { ...defaultDto, outletId: outlet1, brand: 'Monster' });
    await createUseCase.execute(agentPrincipal, { ...defaultDto, outletId: outlet2, brand: 'Rockstar' });

    const listRes = await listUseCase.execute(agentPrincipal, tenantId, { pageSize: 50 });
    assert.strictEqual(listRes.total, 2);

    const filtered = await listUseCase.execute(agentPrincipal, tenantId, { brand: 'monster' });
    assert.strictEqual(filtered.total, 1);
    assert.strictEqual(filtered.data[0].brand, 'Monster');
  });
});
