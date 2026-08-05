import { test, describe } from 'node:test';
import assert from 'node:assert';
import { OutletCensus } from '../outlet-census.js';
import { GeoPoint } from '../../value-objects/geo-point.js';

describe('OutletCensus Domain Invariants & Mutations', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const agentId = '00000000-0000-0000-0000-000000000111';
  const outletId = '00000000-0000-0000-0000-000000000222';
  const geoCoords = GeoPoint.create(28.6139, 77.2090);

  test('OutletCensus should initialize in draft state with pending KYC', () => {
    const census = OutletCensus.create({
      id: 'cen-1',
      tenantId,
      agentId,
      outletId,
      censusDate: '2026-07-17',
      outletName: 'Sagar Store CP',
      outletType: 'kirana',
      ownerName: 'Sagar Kumar',
      ownerPhone: '9876543210',
      address: 'Shop 5, Connaught Place, New Delhi',
      geoCoords,
      tradeCategory: 'Groceries',
    });

    assert.strictEqual(census.id, 'cen-1');
    assert.strictEqual(census.status, 'draft');
    assert.strictEqual(census.kycStatus, 'pending');
    assert.deepStrictEqual(census.photoUrls, []);
  });

  test('OutletCensus state machine transitions', () => {
    const census = OutletCensus.create({
      id: 'cen-2',
      tenantId,
      agentId,
      outletId,
      censusDate: '2026-07-17',
      outletName: 'Sagar Store CP',
      outletType: 'kirana',
      ownerName: 'Sagar Kumar',
      ownerPhone: '9876543210',
      address: 'Shop 5, Connaught Place, New Delhi',
      geoCoords,
      tradeCategory: 'Groceries',
    });

    // 1. Cannot directly approve draft
    assert.throws(() => {
      census.approve();
    }, /Cannot approve census from state: draft/);

    // 2. Draft -> Submitted
    census.submit();
    assert.strictEqual(census.status, 'submitted');

    // 3. Submitted -> Verified
    census.verify();
    assert.strictEqual(census.status, 'verified');

    // 4. Verified -> Approved
    census.approve();
    assert.strictEqual(census.status, 'approved');
  });

  test('OutletCensus KYC and photo mutations', () => {
    const census = OutletCensus.create({
      id: 'cen-3',
      tenantId,
      agentId,
      outletId,
      censusDate: '2026-07-17',
      outletName: 'Sagar Store CP',
      outletType: 'kirana',
      ownerName: 'Sagar Kumar',
      ownerPhone: '9876543210',
      address: 'Shop 5, Connaught Place, New Delhi',
      geoCoords,
      tradeCategory: 'Groceries',
    });

    census.updateKyc('verified', '07AAAAA1111A1Z1', 'ABCDE1234F');
    assert.strictEqual(census.kycStatus, 'verified');
    assert.strictEqual(census.gstin, '07AAAAA1111A1Z1');
    assert.strictEqual(census.panNumber, 'ABCDE1234F');

    census.addPhoto('https://images.com/outlet.jpg');
    assert.deepStrictEqual(census.photoUrls, ['https://images.com/outlet.jpg']);
  });
});
