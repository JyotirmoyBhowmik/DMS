import { test, describe } from 'node:test';
import assert from 'node:assert';
import { CreateJourneyPlanUseCase } from '../create_journey_plan.usecase.js';
import { GetJourneyPlanUseCase } from '../get_journey_plan.usecase.js';
import { UpdateJourneyPlanUseCase } from '../update_journey_plan.usecase.js';
import { ListJourneyPlansUseCase } from '../list_journey_plans.usecase.js';
import { JourneyPlanRepository } from '../../../../infrastructure/database/repositories/journey_plan.repository.js';

describe('JourneyPlan Use Cases Tests', () => {
  const tenantId = 'tenant-uuid-1111';
  const agentId = 'agent-uuid-2222';
  const beatId = 'beat-uuid-3333';
  const repo = new JourneyPlanRepository();

  test('CreateJourneyPlanUseCase should request plans successfully', async () => {
    const useCase = new CreateJourneyPlanUseCase(undefined, repo);
    const result = await useCase.execute(tenantId, agentId, {
      id: 'jp-usecase-101',
      date: '2026-06-20',
      beatId,
      beatName: 'Central Beat Route',
      plannedOutlets: [
        {
          outletId: 'outlet-jp-1',
          outletName: 'Koramangala Supermarket',
          sequence: 1,
          latitude: 12.97,
          longitude: 77.59,
          estimatedArrival: new Date().toISOString(),
          visited: false,
        }
      ]
    });

    assert.strictEqual(result.planId, 'jp-usecase-101');
    assert.strictEqual(result.status, 'planned');

    const created = await repo.findById('jp-usecase-101', tenantId);
    assert.ok(created);
    assert.strictEqual(created.beatName, 'Central Beat Route');
  });

  test('CreateJourneyPlanUseCase should reject duplicate dates for same agent', async () => {
    const useCase = new CreateJourneyPlanUseCase(undefined, repo);
    await assert.rejects(async () => {
      await useCase.execute(tenantId, agentId, {
        id: 'jp-usecase-102',
        date: '2026-06-20', // Same date as previous test
        beatId,
        beatName: 'Alternative Beat Route',
        plannedOutlets: [
          {
            outletId: 'outlet-jp-1',
            outletName: 'Koramangala Supermarket',
            sequence: 1,
            latitude: 12.97,
            longitude: 77.59,
            estimatedArrival: new Date().toISOString(),
            visited: false,
          }
        ]
      });
    });
  });

  test('UpdateJourneyPlanUseCase should execute transitions and optimistic lock', async () => {
    const updateUseCase = new UpdateJourneyPlanUseCase(undefined, repo);
    const result = await updateUseCase.execute(tenantId, 'jp-usecase-101', {
      action: 'start',
    });

    assert.strictEqual(result.status, 'in_progress');

    const updated = await repo.findById('jp-usecase-101', tenantId);
    assert.strictEqual(updated?.status, 'in_progress');
    assert.strictEqual(updated?.version, 1);
  });

  test('ListJourneyPlansUseCase should query filtered results', async () => {
    const listUseCase = new ListJourneyPlansUseCase(undefined, repo);
    const result = await listUseCase.execute(tenantId, {
      agentId,
      status: 'in_progress',
    });

    assert.ok(result.data.length > 0);
    assert.strictEqual(result.data[0]?.id, 'jp-usecase-101');
  });

  test('GetJourneyPlanUseCase should return plan details', async () => {
    const getUseCase = new GetJourneyPlanUseCase(undefined, repo);
    const plan = await getUseCase.execute(tenantId, 'jp-usecase-101');

    assert.ok(plan);
    assert.strictEqual(plan.id, 'jp-usecase-101');
  });
});
