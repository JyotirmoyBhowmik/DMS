import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { CreateGeoCheckInUseCase } from '../create_geo_checkin.usecase.js';
import { GetGeoCheckInUseCase } from '../get_geo_checkin.usecase.js';
import { UpdateGeoCheckInUseCase } from '../update_geo_checkin.usecase.js';
import { ListGeoCheckInsUseCase } from '../list_geo_checkins.usecase.js';
import { GeoCheckInPgRepository } from '../../../../infrastructure/database/repositories/geo-checkin.pg-repository.js';
import { GeoPoint } from '../../../../domain/value-objects/geo-point.js';

describe('GeoCheckIn Use Cases Integration Tests', () => {
  let repo: GeoCheckInPgRepository;
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const agentId = '00000000-0000-0000-0000-000000000002';
  const outletId = '00000000-0000-0000-0000-000000000003';
  const clientCoords = { latitude: 28.6139, longitude: 77.2090 };
  const outletCoords = { latitude: 28.6139, longitude: 77.2090 };
  const deviceInfo = { model: 'iPhone 14', os: 'iOS 16', batteryLevel: 85 };

  beforeEach(() => {
    GeoCheckInPgRepository.clearStore();
    repo = new GeoCheckInPgRepository();
  });

  test('CreateGeoCheckInUseCase should save correctly and determine geofence adherence', async () => {
    const createUseCase = new CreateGeoCheckInUseCase(undefined, repo);
    const result = await createUseCase.execute(tenantId, {
      agentId,
      outletId,
      checkInCoords: clientCoords,
      outletCoords,
      deviceInfo,
    });

    assert.ok(result.geoCheckInId);
    assert.strictEqual(result.isWithinGeofence, true);

    // Retrieve via repository to verify
    const saved = await repo.findById(result.geoCheckInId, tenantId);
    assert.ok(saved);
    assert.strictEqual(saved.agentId, agentId);
    assert.strictEqual(saved.outletId, outletId);
    assert.strictEqual(saved.isWithinGeofence, true);
  });

  test('GetGeoCheckInUseCase should retrieve details or throw if not found', async () => {
    const createUseCase = new CreateGeoCheckInUseCase(undefined, repo);
    const getUseCase = new GetGeoCheckInUseCase(undefined, repo);

    const { geoCheckInId } = await createUseCase.execute(tenantId, {
      agentId,
      outletId,
      checkInCoords: clientCoords,
      outletCoords,
      deviceInfo,
    });

    const record = await getUseCase.execute(tenantId, geoCheckInId);
    assert.strictEqual(record.id, geoCheckInId);

    // Assert that different tenant ID throws unauthorized / not found
    await assert.rejects(async () => {
      await getUseCase.execute('other-tenant', geoCheckInId);
    }, /not found or unauthorized/);
  });

  test('UpdateGeoCheckInUseCase check-out and flag_spoofing actions', async () => {
    const createUseCase = new CreateGeoCheckInUseCase(undefined, repo);
    const updateUseCase = new UpdateGeoCheckInUseCase(undefined, repo);
    const getUseCase = new GetGeoCheckInUseCase(undefined, repo);

    const { geoCheckInId } = await createUseCase.execute(tenantId, {
      agentId,
      outletId,
      checkInCoords: clientCoords,
      outletCoords,
      deviceInfo,
    });

    // 1. Flag spoofing action
    await updateUseCase.execute(tenantId, geoCheckInId, {
      action: 'flag_spoofing',
    });

    const record = await getUseCase.execute(tenantId, geoCheckInId);
    assert.strictEqual(record.spoofingDetected, true);
    assert.strictEqual(record.version, 1);

    // 2. Reject check-out with optimistic locking version mismatch
    await assert.rejects(async () => {
      await updateUseCase.execute(tenantId, geoCheckInId, {
        action: 'check_out',
        coords: clientCoords,
      }, 0); // expected version is 0 but actual version is now 1
    }, /Conflict: version mismatch/);
  });

  test('ListGeoCheckInsUseCase should support paging and filters scoping', async () => {
    const createUseCase = new CreateGeoCheckInUseCase(undefined, repo);
    const listUseCase = new ListGeoCheckInsUseCase(undefined, repo);

    await createUseCase.execute(tenantId, {
      agentId,
      outletId,
      checkInCoords: clientCoords,
      outletCoords,
      deviceInfo,
    });

    const result = await listUseCase.execute(tenantId, {
      agentId,
      outletId,
      page: 1,
      pageSize: 10,
    });

    assert.strictEqual(result.data.length, 1);
    assert.strictEqual(result.data[0]?.agentId, agentId);
    assert.strictEqual(result.data[0]?.outletId, outletId);
  });
});
