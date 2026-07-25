import test from 'node:test';
import assert from 'node:assert';
import { CollectionOfflineCache } from './collection_offline_cache.js';
import { TokenSession } from './session_manager.js';

const mockSession: TokenSession = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresAt: Date.now() + 3600000,
  tenantId: '00000000-0000-0000-0000-000000000001',
  email: 'agent@enterprise.com',
  clientSecretKeyHex: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', // 32 bytes hex
};

void test('CollectionOfflineCache encryption roundtrip', () => {
  const cache = new CollectionOfflineCache(mockSession);
  const collection = {
    id: 'col-mob-001',
    collectionReference: 'COL-MOB-001',
    distributorId: 'dist-1',
    amountCents: 50000,
    collectionMode: 'CASH',
    version: 1,
  };

  cache.saveCollectionOffline(collection, 'create');

  const retrieved = cache.getCollectionOffline('col-mob-001');
  assert.deepStrictEqual(retrieved, collection);

  const queue = cache.getSyncQueue();
  assert.strictEqual(queue.length, 1);
  assert.strictEqual(queue[0].action, 'create');
});

void test('CollectionOfflineCache resolves sync conflict with keep_local strategy', () => {
  const cache = new CollectionOfflineCache(mockSession);
  const collection = {
    id: 'col-mob-002',
    collectionReference: 'COL-MOB-002',
    distributorId: 'dist-1',
    amountCents: 75000,
    collectionMode: 'CHEQUE',
    version: 1,
  };

  cache.saveCollectionOffline(collection, 'create');
  cache.resolveConflict('col-mob-002', 'keep_local', { id: 'col-mob-002', version: 3 });

  const updated = cache.getCollectionOffline('col-mob-002');
  assert.strictEqual(updated.version, 4);
});
