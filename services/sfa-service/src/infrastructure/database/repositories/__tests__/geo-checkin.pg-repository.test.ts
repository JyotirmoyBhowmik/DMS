import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { GeoCheckInPgRepository } from '../geo-checkin.pg-repository.js';
import { GeoCheckIn } from '../../../../domain/entities/geo-checkin.js';
import { GeoPoint } from '../../../../domain/value-objects/geo-point.js';

describe('GeoCheckIn Repository Integration Tests', () => {
  let repo: GeoCheckInPgRepository;
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const agentId = '00000000-0000-0000-0000-000000000002';
  const outletId = '00000000-0000-0000-0000-000000000003';
  const coords = GeoPoint.create(28.6139, 77.2090);

  beforeEach(() => {
    GeoCheckInPgRepository.clearStore();
    repo = new GeoCheckInPgRepository();
  });

  test('Repository save and retrieve operations', async () => {
    const checkIn = GeoCheckIn.create({
      id: 'chk-repo-1',
      tenantId,
      agentId,
      outletId,
      checkInCoords: coords,
      outletCoords: coords,
      deviceInfo: { model: 'OnePlus 11', os: 'Android 13', batteryLevel: 75 },
    });

    // Save
    await repo.save(checkIn);

    // Find by ID
    const found = await repo.findById('chk-repo-1', tenantId);
    assert.ok(found);
    assert.strictEqual(found.agentId, agentId);
    assert.strictEqual(found.outletId, outletId);

    // Find by Agent
    const byAgent = await repo.findByAgent(agentId, tenantId);
    assert.strictEqual(byAgent.length, 1);
    assert.strictEqual(byAgent[0]?.id, 'chk-repo-1');

    // Find by Outlet
    const byOutlet = await repo.findByOutlet(outletId, tenantId);
    assert.strictEqual(byOutlet.length, 1);
    assert.strictEqual(byOutlet[0]?.id, 'chk-repo-1');

    // Delete
    await repo.delete('chk-repo-1', tenantId);
    const afterDelete = await repo.findById('chk-repo-1', tenantId);
    assert.strictEqual(afterDelete, null);
  });
});
