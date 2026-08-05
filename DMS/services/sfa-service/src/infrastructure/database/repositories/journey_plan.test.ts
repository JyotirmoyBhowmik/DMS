import { test, describe } from 'node:test';
import assert from 'node:assert';
import { JourneyPlan } from '../../../domain/entities/journey-plan.js';
import { JourneyPlanRepository } from './journey_plan.repository.js';

describe('JourneyPlan Postgres Repository In-Memory Fallback Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const agentId = 'agent-uuid-5555';
  const beatId = '00000000-0000-0000-0000-000000000002';

  test('Saves and finds a journey plan by agent and date', async () => {
    const repo = new JourneyPlanRepository();
    const plan = JourneyPlan.create({
      id: 'jp-plan-555',
      tenantId,
      agentId,
      date: '2026-06-05',
      beatId,
      beatName: 'Central City beat route',
      plannedOutlets: [
        {
          outletId: 'outlet-1111',
          outletName: 'Supermarket A',
          sequence: 1,
          latitude: 28.6139,
          longitude: 77.2090,
          estimatedArrival: new Date(),
          visited: false,
        }
      ]
    });

    await repo.save(plan);

    const saved = await repo.findById('jp-plan-555', tenantId);
    assert.ok(saved);
    assert.strictEqual(saved.id, 'jp-plan-555');
    assert.strictEqual(saved.beatName, 'Central City beat route');

    const savedByAgent = await repo.findByAgentAndDate(agentId, '2026-06-05', tenantId);
    assert.ok(savedByAgent);
    assert.strictEqual(savedByAgent.id, 'jp-plan-555');
  });
});
