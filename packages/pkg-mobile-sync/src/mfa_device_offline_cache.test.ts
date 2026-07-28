import { test, describe } from 'node:test';
import assert from 'node:assert';
import { MFADeviceOfflineCache } from './mfa_device_offline_cache.js';

describe('MFADeviceOfflineCache Test Suite (Task 1546)', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';

  test('saves and queries local MFA device records', () => {
    const cache = new MFADeviceOfflineCache();

    cache.saveDevice({
      id: 'mfa-001',
      tenantId,
      userId: 'usr-1',
      type: 'TOTP',
      secretEncrypted: 'enc-secret-1',
      isActive: true,
      lastUsedAt: null,
      version: 1,
      isDeleted: false,
      updatedAt: new Date().toISOString(),
    });

    const devices = cache.getDevices(tenantId);
    assert.strictEqual(devices.length, 1);
    assert.strictEqual(devices[0].userId, 'usr-1');
  });

  test('enqueues pending mutations and updates local cache optimistically', () => {
    const cache = new MFADeviceOfflineCache();

    const mut = cache.enqueueMutation('mfa-002', 'CREATE', {
      tenantId,
      userId: 'usr-2',
      type: 'SMS',
      secretEncrypted: '+19998887777',
    });

    assert.ok(mut.mutationId.startsWith('mut-'));
    assert.strictEqual(cache.getPendingMutations().length, 1);

    const dev = cache.getDeviceById('mfa-002', tenantId);
    assert.ok(dev !== null);
    assert.strictEqual(dev.syncStatus, 'PENDING');
  });

  test('resolves server conflicts using server-wins policy', () => {
    const cache = new MFADeviceOfflineCache();

    cache.saveDevice({
      id: 'mfa-003',
      tenantId,
      userId: 'usr-3',
      type: 'EMAIL',
      secretEncrypted: 'user3@domain.com',
      isActive: true,
      lastUsedAt: null,
      version: 1,
      isDeleted: false,
      updatedAt: new Date().toISOString(),
    });

    const resolved = cache.resolveConflict('mfa-003', {
      id: 'mfa-003',
      tenantId,
      userId: 'usr-3',
      type: 'EMAIL',
      secretEncrypted: 'user3-updated@domain.com',
      isActive: false,
      lastUsedAt: new Date().toISOString(),
      version: 2,
      isDeleted: false,
      syncStatus: 'SYNCED',
      updatedAt: new Date().toISOString(),
    });

    assert.strictEqual(resolved.version, 2);
    assert.strictEqual(resolved.isActive, false);
    assert.strictEqual(resolved.syncStatus, 'SYNCED');
  });
});
