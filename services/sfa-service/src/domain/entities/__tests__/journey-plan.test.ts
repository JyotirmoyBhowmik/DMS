import { test, describe } from 'node:test';
import assert from 'node:assert';
import { JourneyPlan } from '../journey-plan.js';

describe('JourneyPlan Domain Entity state machine and rules tests', () => {
  const tenantId = 'tenant-uuid-1111';
  const agentId = 'agent-uuid-2222';
  const beatId = 'beat-uuid-3333';

  const plannedOutlets = [
    {
      outletId: 'outlet-uuid-9999',
      outletName: 'Apex Grocery',
      sequence: 1,
      latitude: 12.9716,
      longitude: 77.5946,
      estimatedArrival: new Date(),
      visited: false,
    }
  ];

  test('Should initialize with PLANNED state', () => {
    const plan = JourneyPlan.create({
      id: 'plan-1',
      tenantId,
      agentId,
      date: '2026-06-15',
      beatId,
      beatName: 'Koramangala route',
      plannedOutlets,
    });

    assert.strictEqual(plan.status, 'planned');
    assert.strictEqual(plan.actualStartTime, null);
  });

  test('Should transition: planned -> in_progress -> completed', () => {
    const plan = JourneyPlan.create({
      id: 'plan-2',
      tenantId,
      agentId,
      date: '2026-06-15',
      beatId,
      beatName: 'Koramangala route',
      plannedOutlets,
    });

    plan.startJourney();
    assert.strictEqual(plan.status, 'in_progress');
    assert.ok(plan.actualStartTime);

    plan.markOutletVisited('outlet-uuid-9999');
    assert.strictEqual(plan.plannedOutlets[0]?.visited, true);

    plan.completeJourney();
    assert.strictEqual(plan.status, 'completed');
    assert.ok(plan.actualEndTime);
  });

  test('Should reject invalid status transitions', () => {
    const plan = JourneyPlan.create({
      id: 'plan-3',
      tenantId,
      agentId,
      date: '2026-06-15',
      beatId,
      beatName: 'Koramangala route',
      plannedOutlets,
    });

    // Cannot complete direct from planned
    assert.throws(() => {
      plan.completeJourney();
    });

    // Cannot visit outlets before starting
    assert.throws(() => {
      plan.markOutletVisited('outlet-uuid-9999');
    });
  });

  test('Should reject modifications once completed', () => {
    const plan = JourneyPlan.create({
      id: 'plan-4',
      tenantId,
      agentId,
      date: '2026-06-15',
      beatId,
      beatName: 'Koramangala route',
      plannedOutlets,
    });

    plan.startJourney();
    plan.completeJourney();

    assert.throws(() => {
      plan.startJourney();
    });

    assert.throws(() => {
      plan.addOutlet({
        outletId: 'new-outlet',
        outletName: 'New Stop',
        sequence: 2,
        latitude: 0,
        longitude: 0,
        estimatedArrival: new Date(),
        visited: false,
      });
    });
  });
});
