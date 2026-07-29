import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { FileObjectOfflineCache } from './file_object_offline_cache.ts';

describe('FileObjectOfflineCache Mobile Offline Sync Tests (Task 1632)', () => {
  let cache: FileObjectOfflineCache;
  const tenantId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    cache = new FileObjectOfflineCache();
  });

  test('should save item locally in offline cache and queue CREATE mutation', async () => {
    const saved = await cache.save({
      id: 'file-off-1',
      tenantId,
      filename: 'offline_invoice.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      storagePath: '/local/invoice.pdf',
      checksum: 'chk-off',
      status: 'PENDING',
      version: 1
    });

    assert.equal(saved.isSynced, false);
    assert.equal(saved.isDeleted, false);

    const pending = cache.getPendingMutations();
    assert.equal(pending.length, 1);
    assert.equal(pending[0].action, 'CREATE');
    assert.equal(pending[0].file.id, 'file-off-1');
  });

  test('should mark synced and remove mutation from pending queue', async () => {
    await cache.save({
      id: 'file-off-2',
      tenantId,
      filename: 'offline_receipt.png',
      mimeType: 'image/png',
      sizeBytes: 512,
      storagePath: '/local/receipt.png',
      checksum: 'chk-png',
      status: 'PENDING',
      version: 1
    });

    await cache.markSynced('file-off-2', 2);

    const item = await cache.getById('file-off-2');
    assert.ok(item);
    assert.equal(item.isSynced, true);
    assert.equal(item.version, 2);

    const pending = cache.getPendingMutations();
    assert.equal(pending.length, 0);
  });

  test('should handle tombstone soft deletion when offline', async () => {
    await cache.save({
      id: 'file-off-3',
      tenantId,
      filename: 'temp.log',
      mimeType: 'text/plain',
      sizeBytes: 64,
      storagePath: '/local/temp.log',
      checksum: 'chk-log',
      status: 'PENDING',
      version: 1
    });

    const deleted = await cache.delete('file-off-3');
    assert.equal(deleted, true);

    const fetched = await cache.getById('file-off-3');
    assert.equal(fetched, null); // Soft deleted tombstone

    const all = await cache.getAll(tenantId);
    assert.equal(all.length, 0);
  });
});
