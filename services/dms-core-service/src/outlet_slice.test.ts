import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Outlet } from './domain/entities/outlet.js';
import { OutletPgRepository } from './infrastructure/database/repositories/outlet.pg-repository.js';
import { CreateOutletUseCase } from './application/usecases/outlet/create-outlet.usecase.js';
import { GetOutletUseCase } from './application/usecases/outlet/get-outlet.usecase.js';
import { UpdateOutletUseCase } from './application/usecases/outlet/update-outlet.usecase.js';
import { ListOutletsUseCase } from './application/usecases/outlet/list-outlets.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('Outlet Full Vertical Slice Unit & Repo Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const principal: Principal = {
    id: 'admin-user-1',
    tenantId,
    roles: ['admin'],
  };

  const mockDb: any = {
    query: async () => ({ rows: [] }),
  };

  beforeEach(() => {
    OutletPgRepository.clearStore();
  });

  describe('Outlet Domain Aggregate & Geofence Invariants', () => {
    test('validates coordinate bounds and evaluates Haversine geofence entry distance', () => {
      const outlet = Outlet.create({
        id: randomUUID(),
        tenantId,
        name: 'Metro Retail Store 101',
        latitude: 12.9716, // Bangalore coordinates
        longitude: 77.5946,
        radiusMeters: 100,
      });

      // 1. Inside 100m geofence (same coords)
      const inGeofence = outlet.isWithinGeofence(12.9716, 77.5946);
      assert.strictEqual(inGeofence.compliant, true);
      assert.strictEqual(inGeofence.distanceMeters, 0);

      // 2. Far outside geofence
      const outGeofence = outlet.isWithinGeofence(13.0000, 77.6000);
      assert.strictEqual(outGeofence.compliant, false);
      assert.ok(outGeofence.distanceMeters > 500);

      // 3. Invalid latitude boundary error
      assert.throws(
        () => Outlet.create({ id: randomUUID(), tenantId, name: 'Invalid', latitude: 120, longitude: 77 }),
        /Latitude must be between -90 and 90/
      );
    });
  });

  describe('Outlet Use Cases & Repository', () => {
    test('executes Create with idempotency key', async () => {
      const repo = new OutletPgRepository(mockDb);
      const createUseCase = new CreateOutletUseCase(repo);

      const dto = {
        name: 'Apex Supermarket',
        latitude: 28.6139,
        longitude: 77.2090,
        radiusMeters: 50,
        channelType: 'RETAIL' as const,
      };

      const o1 = await createUseCase.execute(principal, dto, 'key-outlet-101');
      assert.strictEqual(o1.name, 'Apex Supermarket');

      // Idempotent retry
      const o2 = await createUseCase.execute(principal, dto, 'key-outlet-101');
      assert.strictEqual(o2.id, o1.id);
    });

    test('executes Get, Update status, and List use cases with optimistic locking', async () => {
      const repo = new OutletPgRepository(mockDb);
      const createUseCase = new CreateOutletUseCase(repo);
      const getUseCase = new GetOutletUseCase(repo);
      const updateUseCase = new UpdateOutletUseCase(repo);
      const listUseCase = new ListOutletsUseCase(repo);

      const created = await createUseCase.execute(principal, {
        name: 'Central Mart',
        latitude: 19.0760,
        longitude: 72.8777,
        channelType: 'RETAIL' as const,
      });

      // Get
      const fetched = await getUseCase.execute(principal, created.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.name, 'Central Mart');

      // List
      const list = await listUseCase.execute(principal, { channelType: 'RETAIL' as const });
      assert.strictEqual(list.total, 1);

      // Optimistic Concurrency Failure
      await assert.rejects(
        () => updateUseCase.execute(principal, created.id, { name: 'New Name', version: 999 }),
        /Optimistic locking failure/
      );

      // Update Outlet Success
      const updated = await updateUseCase.execute(principal, created.id, {
        name: 'Central Mart Express',
        status: 'INACTIVE' as const,
        version: 1,
      });
      assert.strictEqual(updated.name, 'Central Mart Express');
      assert.strictEqual(updated.status, 'INACTIVE');
      assert.strictEqual(updated.version, 2);
    });
  });
});
