import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import { OutletProfile, OutletType, OutletProfileStatus } from './domain/entities/outlet-profile.js';
import { GeoPoint } from './domain/value-objects/geo-point.js';
import { OutletProfilePgRepository } from './infrastructure/database/repositories/outlet-profile.pg-repository.js';
import { CreateOutletProfileUseCase } from './application/usecases/outlet-profile/create-outlet-profile.usecase.js';
import { GetOutletProfileUseCase } from './application/usecases/outlet-profile/get-outlet-profile.usecase.js';
import { UpdateOutletProfileUseCase } from './application/usecases/outlet-profile/update-outlet-profile.usecase.js';
import { ListOutletProfilesUseCase } from './application/usecases/outlet-profile/list-outlet-profiles.usecase.js';
import { OutletProfileController } from './presentation/rest/controllers/outlet-profile.controller.js';

describe('SFA OutletProfile Slice Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const id = '00000000-0000-0000-0000-000000000111';

  beforeEach(() => {
    OutletProfileController.clearStore();
  });

  describe('1. Domain Entity aggregate', () => {
    test('Should create and reconstitute OutletProfile aggregate', () => {
      const geo = GeoPoint.create(12.9716, 77.5946);
      const profile = OutletProfile.create({
        id,
        tenantId,
        outletName: 'Metro Mart CP',
        outletType: 'kirana',
        ownerName: 'Amit Kumar',
        ownerPhone: '9876543210',
        address: 'Connaught Place, New Delhi',
        geoCoords: geo,
        kycStatus: 'pending',
        status: 'active',
      });

      assert.strictEqual(profile.id, id);
      assert.strictEqual(profile.outletName, 'Metro Mart CP');
      assert.strictEqual(profile.status, 'active');
      assert.strictEqual(profile.version, 1);

      profile.deactivate();
      assert.strictEqual(profile.status, 'inactive');

      profile.activate();
      assert.strictEqual(profile.status, 'active');

      profile.updateDetails({ outletName: 'Metro Mart Connaught Place' });
      assert.strictEqual(profile.outletName, 'Metro Mart Connaught Place');

      profile.incrementVersion();
      assert.strictEqual(profile.version, 2);
    });
  });

  describe('2. Postgres Repository implementation', () => {
    test('Should save, find, and delete profiles from repository', async () => {
      const repo = new OutletProfilePgRepository();
      const geo = GeoPoint.create(28.6139, 77.2090);
      const profile = OutletProfile.create({
        id,
        tenantId,
        outletName: 'Central Zone Store',
        outletType: 'supermarket',
        ownerName: 'Rahul Dev',
        ownerPhone: '9999999999',
        address: 'Connaught Place',
        geoCoords: geo,
      });

      await repo.save(profile);

      const found = await repo.findById(id, tenantId);
      assert.ok(found);
      assert.strictEqual(found.outletName, 'Central Zone Store');

      const all = await repo.findAll(tenantId);
      assert.strictEqual(all.length, 1);

      await repo.delete(id, tenantId);
      const afterDelete = await repo.findById(id, tenantId);
      assert.strictEqual(afterDelete, null);
    });
  });

  describe('3. CRUD Use Cases execution', () => {
    test('Should execute Create, Get, Update, and List Use Cases', async () => {
      const repo = new OutletProfilePgRepository();
      const createUseCase = new CreateOutletProfileUseCase(undefined, repo);
      const getUseCase = new GetOutletProfileUseCase(undefined, repo);
      const updateUseCase = new UpdateOutletProfileUseCase(undefined, repo);
      const listUseCase = new ListOutletProfilesUseCase(undefined, repo);

      // Create
      const resCreate = await createUseCase.execute(tenantId, {
        id,
        outletName: 'Koramangala Mart',
        outletType: 'supermarket',
        ownerName: 'Vikas Sharma',
        ownerPhone: '9888888888',
        address: '5th Block Koramangala',
        geoCoords: { latitude: 12.93, longitude: 77.62 },
        kycStatus: 'verified',
        status: 'active',
      });

      assert.strictEqual(resCreate.outletProfileId, id);

      // Get
      const profile = await getUseCase.execute(id, tenantId);
      assert.strictEqual(profile.outletName, 'Koramangala Mart');

      // Update
      const updated = await updateUseCase.execute(id, tenantId, {
        outletName: 'Koramangala Mega Mart',
        ownerPhone: '9777777777',
        version: 1,
      });
      assert.strictEqual(updated.outletName, 'Koramangala Mega Mart');
      assert.strictEqual(updated.ownerPhone, '9777777777');
      assert.strictEqual(updated.version, 2);

      // List
      const listRes = await listUseCase.execute(tenantId, { pageSize: 10 });
      assert.strictEqual(listRes.total, 1);
      assert.strictEqual(listRes.data[0].outletName, 'Koramangala Mega Mart');
    });

    test('Should fail update if version concurrency mismatch occurs', async () => {
      const repo = new OutletProfilePgRepository();
      const createUseCase = new CreateOutletProfileUseCase(undefined, repo);
      const updateUseCase = new UpdateOutletProfileUseCase(undefined, repo);

      await createUseCase.execute(tenantId, {
        id,
        outletName: 'Version Shop',
        outletType: 'general',
        ownerName: 'Sanjay Dutt',
        ownerPhone: '9666666666',
        address: 'Vasant Vihar',
        geoCoords: { latitude: 28.57, longitude: 77.16 },
      });

      await assert.rejects(
        updateUseCase.execute(id, tenantId, {
          outletName: 'New Name',
          version: 99, // mismatch!
        }),
        /Optimistic locking conflict/
      );
    });
  });

  describe('4. REST Controller routes mapping', () => {
    test('Should validate inputs and return 201/200 HTTP responses', async () => {
      const controller = new OutletProfileController();

      // Create
      const postRes = await controller.handlePostOutletProfile({
        id,
        outletName: 'Select Market',
        outletType: 'pharmacy',
        ownerName: 'Dr. Ramesh',
        ownerPhone: '9555555555',
        address: 'Saket, New Delhi',
        geoCoords: { latitude: 28.52, longitude: 77.21 },
      }, { 'x-tenant-id': tenantId });

      assert.strictEqual(postRes.statusCode, 201);
      assert.strictEqual(postRes.body.success, true);

      // Get
      const getRes = await controller.handleGetOutletProfile(id, { 'x-tenant-id': tenantId });
      assert.strictEqual(getRes.statusCode, 200);
      assert.strictEqual(getRes.body.outletProfile.outletName, 'Select Market');

      // Put
      const putRes = await controller.handlePutOutletProfile(id, {
        outletName: 'Select Pharmacy Saket',
        version: 1,
      }, { 'x-tenant-id': tenantId });

      assert.strictEqual(putRes.statusCode, 200);
      assert.strictEqual(putRes.body.version, 2);

      // List
      const listRes = await controller.handleListOutletProfiles({ pageSize: 5 }, { 'x-tenant-id': tenantId });
      assert.strictEqual(listRes.statusCode, 200);
      assert.strictEqual(listRes.body.total, 1);
    });

    test('Should return 400 validation error for invalid phone numbers', async () => {
      const controller = new OutletProfileController();

      const postRes = await controller.handlePostOutletProfile({
        id,
        outletName: 'Invalid Phone Store',
        outletType: 'kirana',
        ownerName: 'Rahul',
        ownerPhone: '123', // too short
        address: 'Dwarka',
        geoCoords: { latitude: 28.59, longitude: 77.06 },
      }, { 'x-tenant-id': tenantId });

      assert.strictEqual(postRes.statusCode, 400);
      assert.ok(postRes.body.errors);
    });
  });

  describe('5. Negative Security & Tenant Isolation Suite', () => {
    test('Should block cross-tenant access and updates', async () => {
      const controller = new OutletProfileController();
      const tenantA = '00000000-0000-0000-0000-00000000000a';
      const tenantB = '00000000-0000-0000-0000-00000000000b';

      // Create in Tenant A
      await controller.handlePostOutletProfile({
        id,
        outletName: 'Tenant A Store',
        outletType: 'kirana',
        ownerName: 'Owner A',
        ownerPhone: '9000000000',
        address: 'Delhi',
        geoCoords: { latitude: 28, longitude: 77 },
      }, { 'x-tenant-id': tenantA });

      // Tenant B tries to retrieve Tenant A's store -> should fail (not found)
      const getRes = await controller.handleGetOutletProfile(id, { 'x-tenant-id': tenantB });
      assert.strictEqual(getRes.statusCode, 404);

      // Tenant B tries to update Tenant A's store -> should fail (not found)
      const putRes = await controller.handlePutOutletProfile(id, {
        outletName: 'Hacked Store',
        version: 1
      }, { 'x-tenant-id': tenantB });
      assert.strictEqual(putRes.statusCode, 404);
    });

    test('Should reject oversized payloads and injection patterns', async () => {
      const controller = new OutletProfileController();

      // Injection pattern in ID
      const postResInjection = await controller.handlePostOutletProfile({
        id: "1' OR '1'='1",
        outletName: 'Injected Store',
        outletType: 'kirana',
        ownerName: 'Owner',
        ownerPhone: '9000000000',
        address: 'Delhi',
        geoCoords: { latitude: 28, longitude: 77 },
      }, { 'x-tenant-id': tenantId });
      assert.strictEqual(postResInjection.statusCode, 400);

      // Oversized string payload (simulated)
      const postResOversized = await controller.handlePostOutletProfile({
        id,
        outletName: 'A'.repeat(5000), // Exceeds typical length constraints
        outletType: 'kirana',
        ownerName: 'Owner',
        ownerPhone: '9000000000',
        address: 'Delhi',
        geoCoords: { latitude: 28, longitude: 77 },
      }, { 'x-tenant-id': tenantId });
      assert.strictEqual(postResOversized.statusCode, 400);
    });
  });
});
