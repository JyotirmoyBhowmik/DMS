import test from 'node:test';
import assert from 'node:assert';
import { OutletOfflineCache } from './outlet_offline_cache.js';
import { TokenSession } from './session_manager.js';

const mockSession: TokenSession = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresAt: Date.now() + 3600000,
  tenantId: '00000000-0000-0000-0000-000000000001',
  email: 'agent@enterprise.com',
  clientSecretKeyHex: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', // 32 bytes hex
};

void test('OutletOfflineCache encryption, offline caching, and sync roundtrip', async () => {
  const cache = new OutletOfflineCache(mockSession);
  const outletData = {
    id: 'outlet-offline-101',
    name: 'Metro Retail Mart',
    latitude: 12.9716,
    longitude: 77.5946,
    radiusMeters: 50,
    channelType: 'RETAIL',
    version: 1,
  };

  // 1. Save offline
  cache.saveOutletOffline(outletData, 'create');
  assert.strictEqual(cache.getSyncQueue().length, 1);

  // 2. Retrieve & decrypt
  const retrieved = cache.getOutletOffline('outlet-offline-101');
  assert.deepStrictEqual(retrieved, outletData);

  // 3. Sync successfully
  await cache.syncOutlet('outlet-offline-101', async () => ({ success: true }));
  assert.strictEqual(cache.getSyncQueue().length, 0);
  assert.strictEqual(cache.getOutletOffline('outlet-offline-101'), null);
});
