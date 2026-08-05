import test from 'node:test';
import assert from 'node:assert';
import { KYCDocumentOfflineCache } from './kyc_document_offline_cache.js';
import { TokenSession } from './session_manager.js';

const mockSession: TokenSession = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresAt: Date.now() + 3600000,
  tenantId: '00000000-0000-0000-0000-000000000001',
  email: 'agent@enterprise.com',
  clientSecretKeyHex: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', // 32 bytes hex
};

void test('KYCDocumentOfflineCache encryption, offline caching, and sync roundtrip', async () => {
  const cache = new KYCDocumentOfflineCache(mockSession);
  const docData = {
    id: 'kyc-offline-101',
    distributorId: 'dist-uuid-99',
    documentType: 'GSTIN',
    documentNumber: '29ABCDE1234F1Z5',
    version: 1,
  };

  // 1. Save offline
  cache.saveDocumentOffline(docData, 'create');
  assert.strictEqual(cache.getSyncQueue().length, 1);

  // 2. Retrieve & decrypt
  const retrieved = cache.getDocumentOffline('kyc-offline-101');
  assert.deepStrictEqual(retrieved, docData);

  // 3. Sync successfully
  await cache.syncDocument('kyc-offline-101', async () => ({ success: true }));
  assert.strictEqual(cache.getSyncQueue().length, 0);
  assert.strictEqual(cache.getDocumentOffline('kyc-offline-101'), null);
});
