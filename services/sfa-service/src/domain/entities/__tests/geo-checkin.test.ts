import { test, describe } from 'node:test';
import assert from 'node:assert';
import { GeoCheckIn } from '../geo-checkin.js';
import { GeoPoint } from '../../value-objects/geo-point.js';

describe('GeoCheckIn Domain Invariants & Mutations', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const agentId = '00000000-0000-0000-0000-000000000111';
  const outletId = '00000000-0000-0000-0000-000000000222';
  const DelhiCenter = GeoPoint.create(28.6139, 77.2090);

  test('GeoCheckIn should calculate distance and geofence adherence correctly at creation', () => {
    // 1. Within Geofence (10m away)
    const clientCoords = GeoPoint.create(28.6139, 77.2091);
    const checkIn = GeoCheckIn.create({
      id: 'chk-1',
      tenantId,
      agentId,
      outletId,
      checkInCoords: clientCoords,
      outletCoords: DelhiCenter,
      deviceInfo: { model: 'iPhone 15', os: 'iOS 17', batteryLevel: 90 },
      geofenceRadiusM: 50,
    });

    assert.strictEqual(checkIn.id, 'chk-1');
    assert.strictEqual(checkIn.tenantId, tenantId);
    assert.strictEqual(checkIn.agentId, agentId);
    assert.strictEqual(checkIn.outletId, outletId);
    assert.strictEqual(checkIn.isWithinGeofence, true);
    assert.strictEqual(checkIn.spoofingDetected, false);
    assert.ok(checkIn.distanceFromOutlet > 0 && checkIn.distanceFromOutlet < 50);

    // 2. Outside Geofence (~1.1km away)
    const farCoords = GeoPoint.create(28.6239, 77.2090);
    const farCheckIn = GeoCheckIn.create({
      id: 'chk-2',
      tenantId,
      agentId,
      outletId,
      checkInCoords: farCoords,
      outletCoords: DelhiCenter,
      deviceInfo: { model: 'iPhone 15', os: 'iOS 17', batteryLevel: 90 },
      geofenceRadiusM: 50,
    });

    assert.strictEqual(farCheckIn.isWithinGeofence, false);
  });

  test('GeoCheckIn should enforce minimum 2-minute duration at check-out', () => {
    const checkIn = GeoCheckIn.create({
      id: 'chk-3',
      tenantId,
      agentId,
      outletId,
      checkInCoords: DelhiCenter,
      outletCoords: DelhiCenter,
      deviceInfo: { model: 'Pixel 8', os: 'Android 14', batteryLevel: 80 },
    });

    // Attempt immediate check-out -> should fail due to 2-minute rule
    assert.throws(() => {
      checkIn.checkOut(DelhiCenter);
    }, /Minimum visit duration is 2 minutes/);

    // Reconstitute with checkInTime 3 minutes in the past to test successful check-out
    const threeMinutesAgo = new Date(Date.now() - 3 * 60_000);
    const pastCheckIn = GeoCheckIn.reconstitute({
      id: checkIn.id,
      tenantId: checkIn.tenantId,
      agentId: checkIn.agentId,
      outletId: checkIn.outletId,
      visitId: null,
      checkInTime: threeMinutesAgo,
      checkOutTime: null,
      checkInCoords: checkIn.checkInCoords,
      checkOutCoords: null,
      distanceFromOutlet: checkIn.distanceFromOutlet,
      isWithinGeofence: checkIn.isWithinGeofence,
      spoofingDetected: checkIn.spoofingDetected,
      deviceInfo: checkIn.deviceInfo,
      createdAt: threeMinutesAgo,
      updatedAt: threeMinutesAgo,
      version: 1,
    });

    pastCheckIn.checkOut(DelhiCenter);
    assert.ok(pastCheckIn.checkOutTime);
    assert.strictEqual(pastCheckIn.durationMinutes(), 3);
  });

  test('GeoCheckIn flagSpoofing should update spoofing status', () => {
    const checkIn = GeoCheckIn.create({
      id: 'chk-4',
      tenantId,
      agentId,
      outletId,
      checkInCoords: DelhiCenter,
      outletCoords: DelhiCenter,
      deviceInfo: { model: 'Pixel 8', os: 'Android 14', batteryLevel: 80 },
    });

    assert.strictEqual(checkIn.spoofingDetected, false);
    checkIn.flagSpoofing();
    assert.strictEqual(checkIn.spoofingDetected, true);
  });
});
