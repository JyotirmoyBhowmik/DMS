import { test, describe } from 'node:test';
import assert from 'node:assert';
import { BeatRoute } from '../beat-route.js';

describe('BeatRoute Domain Entity state machine and rules tests', () => {
  const tenantId = 'tenant-uuid-1111';

  test('Should initialize with DRAFT status', () => {
    const route = BeatRoute.create({
      id: 'route-1',
      tenantId,
      name: 'Delhi Retail Beat',
      region: 'Delhi',
    });

    assert.strictEqual(route.status, 'draft');
    assert.strictEqual(route.isActive, true);
  });

  test('Should transition: draft -> active -> suspended -> archived', () => {
    const route = BeatRoute.create({
      id: 'route-2',
      tenantId,
      name: 'Delhi Retail Beat',
      region: 'Delhi',
    });

    route.activate();
    assert.strictEqual(route.status, 'active');
    assert.strictEqual(route.isActive, true);

    route.suspend();
    assert.strictEqual(route.status, 'suspended');
    assert.strictEqual(route.isActive, false);

    route.archive();
    assert.strictEqual(route.status, 'archived');
    assert.strictEqual(route.isActive, false);
  });

  test('Should reject invalid status transitions', () => {
    const route = BeatRoute.create({
      id: 'route-3',
      tenantId,
      name: 'Delhi Retail Beat',
      region: 'Delhi',
    });

    // Cannot archive directly from draft
    assert.throws(() => {
      route.archive();
    });

    // Cannot suspend directly from draft
    assert.throws(() => {
      route.suspend();
    });
  });

  test('Should enforce contiguous sequence rules on outlets', () => {
    const route = BeatRoute.create({
      id: 'route-4',
      tenantId,
      name: 'Delhi Retail Beat',
      region: 'Delhi',
    });

    route.addOutlet({
      outletId: 'out-1',
      sequence: 1,
      lat: 28,
      lng: 77
    });

    // Sequence gap: sequence 3 without 2
    assert.throws(() => {
      route.addOutlet({
        outletId: 'out-2',
        sequence: 3,
        lat: 28,
        lng: 77
      });
    });

    // Valid next sequence 2
    route.addOutlet({
      outletId: 'out-2',
      sequence: 2,
      lat: 28,
      lng: 77
    });
    assert.strictEqual(route.outlets.length, 2);
  });
});
