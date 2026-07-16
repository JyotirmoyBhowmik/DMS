import { test, describe } from 'node:test';
import assert from 'node:assert';
import { Visit } from '../visit.js';
import { GeoPoint } from '../../value-objects/geo-point.js';

describe('Visit Domain Entity Invariants', () => {
  test('Should initialize correctly in planned status', () => {
    const visit = Visit.create({
      id: 'visit-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      outletId: 'outlet-1',
      journeyPlanId: 'jp-1',
      plannedDate: new Date('2026-06-05T09:00:00Z'),
    });

    assert.strictEqual(visit.id, 'visit-1');
    assert.strictEqual(visit.status, 'planned');
    assert.strictEqual(visit.checkInTime, null);
    assert.strictEqual(visit.checkOutTime, null);
  });

  test('Should handle correct checkIn state transitions', () => {
    const visit = Visit.create({
      id: 'visit-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      outletId: 'outlet-1',
      journeyPlanId: 'jp-1',
      plannedDate: new Date('2026-06-05T09:00:00Z'),
    });

    const point = GeoPoint.create(28.6139, 77.2090);
    visit.checkIn(point);

    assert.strictEqual(visit.status, 'in_progress');
    assert.ok(visit.checkInTime instanceof Date);
    assert.strictEqual(visit.checkInLocation?.latitude, 28.6139);
  });

  test('Should reject checkIn from invalid states', () => {
    const visit = Visit.create({
      id: 'visit-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      outletId: 'outlet-1',
      journeyPlanId: 'jp-1',
      plannedDate: new Date(),
    });

    visit.checkIn(GeoPoint.create(28, 77));

    // Try checkIn again
    assert.throws(() => {
      visit.checkIn(GeoPoint.create(28, 77));
    }, /Cannot check in/);
  });

  test('Should handle recordTask in progress', () => {
    const visit = Visit.create({
      id: 'visit-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      outletId: 'outlet-1',
      journeyPlanId: 'jp-1',
      plannedDate: new Date(),
    });

    assert.throws(() => {
      visit.recordTask({
        taskId: 't-1',
        taskType: 'audit',
        notes: 'notes',
        completedAt: new Date(),
      });
    }, /Cannot record tasks/);

    visit.checkIn(GeoPoint.create(28, 77));
    visit.recordTask({
      taskId: 't-1',
      taskType: 'audit',
      notes: 'notes',
      completedAt: new Date(),
    });

    assert.strictEqual(visit.tasksCompleted.length, 1);
    assert.strictEqual(visit.tasksCompleted[0]?.taskType, 'audit');
  });

  test('Should handle correct checkOut transition', () => {
    const visit = Visit.create({
      id: 'visit-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      outletId: 'outlet-1',
      journeyPlanId: 'jp-1',
      plannedDate: new Date(),
    });

    visit.checkIn(GeoPoint.create(28, 77));
    visit.checkOut(GeoPoint.create(28.1, 77.1));

    assert.strictEqual(visit.status, 'completed');
    assert.ok(visit.checkOutTime instanceof Date);
    assert.strictEqual(visit.checkOutLocation?.latitude, 28.1);
  });

  test('Should handle skip transition', () => {
    const visit = Visit.create({
      id: 'visit-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      outletId: 'outlet-1',
      journeyPlanId: 'jp-1',
      plannedDate: new Date(),
    });

    visit.skip();
    assert.strictEqual(visit.status, 'skipped');
  });
});
