import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { OutletCensusPgRepository } from '../outlet-census.pg-repository.js';
import { OutletCensus } from '../../../../domain/entities/outlet-census.js';
import { GeoPoint } from '../../../../domain/value-objects/geo-point.js';

describe('OutletCensus Repository Integration Tests', () => {
  let repo: OutletCensusPgRepository;
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const agentId = '00000000-0000-0000-0000-000000000002';
  const outletId = '00000000-0000-0000-0000-000000000003';
  const geoCoords = GeoPoint.create(28.6139, 77.2090);

  beforeEach(() => {
    OutletCensusPgRepository.clearStore();
    repo = new OutletCensusPgRepository();
  });

  test('Repository CRUD operations', async () => {
    const census = OutletCensus.create({
      id: 'cen-repo-1',
      tenantId,
      agentId,
      outletId,
      censusDate: '2026-07-17',
      outletName: 'Sagar Store CP',
      outletType: 'kirana',
      ownerName: 'Sagar Kumar',
      ownerPhone: '9876543210',
      address: 'Shop 5, New Delhi',
      geoCoords,
      tradeCategory: 'Groceries',
    });

    // Save
    await repo.save(census);

    // Find by ID
    const found = await repo.findById('cen-repo-1', tenantId);
    assert.ok(found);
    assert.strictEqual(found.ownerName, 'Sagar Kumar');

    // Find by Outlet
    const byOutlet = await repo.findByOutlet(outletId, tenantId);
    assert.strictEqual(byOutlet.length, 1);
    assert.strictEqual(byOutlet[0]?.id, 'cen-repo-1');

    // Find by Agent
    const byAgent = await repo.findByAgent(agentId, tenantId);
    assert.strictEqual(byAgent.length, 1);
    assert.strictEqual(byAgent[0]?.id, 'cen-repo-1');

    // Delete
    await repo.delete('cen-repo-1', tenantId);
    const afterDelete = await repo.findById('cen-repo-1', tenantId);
    assert.strictEqual(afterDelete, null);
  });
});
