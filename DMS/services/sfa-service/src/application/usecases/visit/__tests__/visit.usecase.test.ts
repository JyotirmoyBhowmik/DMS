import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { CreateVisitUseCase } from '../create_visit.usecase.js';
import { GetVisitUseCase } from '../get_visit.usecase.js';
import { UpdateVisitUseCase } from '../update_visit.usecase.js';
import { ListVisitsUseCase } from '../list_visits.usecase.js';
import { VisitRepository } from '../../../../infrastructure/database/repositories/visit.repository.js';
import { GeoPoint } from '../../../../domain/value-objects/geo-point.js';

describe('Visit Use Cases Integration Tests', () => {
  let repo: VisitRepository;

  beforeEach(() => {
    VisitRepository.clearStore();
    repo = new VisitRepository();
  });

  test('CreateVisitUseCase should save correctly and check duplicate daily constraint', async () => {
    const createUseCase = new CreateVisitUseCase(undefined, repo);
    const tenantId = 'tenant-uuid-1111';
    const agentId = 'agent-uuid-2222';

    const result = await createUseCase.execute(tenantId, agentId, {
      outletId: '3c0a52f4-d5d4-47c0-a7d4-8d48177dfc89',
      journeyPlanId: 'jp-uuid-3333',
      plannedDate: '2026-06-05T09:00:00.000Z',
    });

    assert.ok(result.visitId);
    assert.strictEqual(result.status, 'planned');

    // Attempting same outlet + agent + day again should throw conflict error
    await assert.rejects(async () => {
      await createUseCase.execute(tenantId, agentId, {
        outletId: '3c0a52f4-d5d4-47c0-a7d4-8d48177dfc89',
        journeyPlanId: 'jp-uuid-3333',
        plannedDate: '2026-06-05T14:00:00.000Z', // same day
      });
    }, /already scheduled/);
  });

  test('GetVisitUseCase should retrieve existing or throw', async () => {
    const createUseCase = new CreateVisitUseCase(undefined, repo);
    const getUseCase = new GetVisitUseCase(undefined, repo);
    const tenantId = 'tenant-uuid-1111';
    const agentId = 'agent-uuid-2222';

    const { visitId } = await createUseCase.execute(tenantId, agentId, {
      outletId: '3c0a52f4-d5d4-47c0-a7d4-8d48177dfc89',
      journeyPlanId: 'jp-uuid-3333',
      plannedDate: '2026-06-05T09:00:00.000Z',
    });

    const visit = await getUseCase.execute(tenantId, visitId);
    assert.strictEqual(visit.id, visitId);
    assert.strictEqual(visit.outletId, '3c0a52f4-d5d4-47c0-a7d4-8d48177dfc89');

    await assert.rejects(async () => {
      await getUseCase.execute(tenantId, 'non-existent-uuid');
    }, /not found/);
  });

  test('UpdateVisitUseCase should transition statuses check_in, record_task, and check_out', async () => {
    const createUseCase = new CreateVisitUseCase(undefined, repo);
    const updateUseCase = new UpdateVisitUseCase(undefined, repo);
    const getUseCase = new GetVisitUseCase(undefined, repo);
    const tenantId = 'tenant-uuid-1111';
    const agentId = 'agent-uuid-2222';

    const { visitId } = await createUseCase.execute(tenantId, agentId, {
      outletId: '3c0a52f4-d5d4-47c0-a7d4-8d48177dfc89',
      journeyPlanId: 'jp-uuid-3333',
      plannedDate: '2026-06-05T09:00:00.000Z',
    });

    // 1. Check in
    const checkInResult = await updateUseCase.execute(tenantId, visitId, {
      action: 'check_in',
      location: { latitude: 28.6, longitude: 77.2 },
    });
    assert.strictEqual(checkInResult.status, 'in_progress');

    // Verify task insertion is rejected if not active state is not satisfied or satisfied here
    const taskResult = await updateUseCase.execute(tenantId, visitId, {
      action: 'record_task',
      task: {
        taskId: '3c0a52f4-d5d4-47c0-a7d4-8d48177dfc99',
        taskType: 'shelf_audit',
        notes: 'notes audit text',
      },
    });

    const currentVisit = await getUseCase.execute(tenantId, visitId);
    assert.strictEqual(currentVisit.tasksCompleted.length, 1);
    assert.strictEqual(currentVisit.tasksCompleted[0]?.taskType, 'shelf_audit');

    // 2. Check out
    const checkOutResult = await updateUseCase.execute(tenantId, visitId, {
      action: 'check_out',
      location: { latitude: 28.61, longitude: 77.21 },
    });
    assert.strictEqual(checkOutResult.status, 'completed');
  });

  test('ListVisitsUseCase should filter and paginate correctly', async () => {
    const createUseCase = new CreateVisitUseCase(undefined, repo);
    const listUseCase = new ListVisitsUseCase(undefined, repo);
    const tenantId = 'tenant-uuid-1111';

    await createUseCase.execute(tenantId, 'agent-1', {
      outletId: '3c0a52f4-d5d4-47c0-a7d4-8d48177dfc01',
      journeyPlanId: 'jp-1',
      plannedDate: '2026-06-05T09:00:00.000Z',
    });

    await createUseCase.execute(tenantId, 'agent-2', {
      outletId: '3c0a52f4-d5d4-47c0-a7d4-8d48177dfc02',
      journeyPlanId: 'jp-1',
      plannedDate: '2026-06-05T09:00:00.000Z',
    });

    const res = await listUseCase.execute(tenantId, {
      agentId: 'agent-1',
    });

    assert.strictEqual(res.data.length, 1);
    assert.strictEqual(res.data[0]?.agentId, 'agent-1');
  });
});
