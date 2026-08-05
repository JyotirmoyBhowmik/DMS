import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FlagClient } from './index.js';

describe('Config Client (FlagClient) Tests', () => {
  let originalFetch: typeof globalThis.fetch;
  const tempDir = join(tmpdir(), 'dms-config-test-' + Date.now());

  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    await fs.mkdir(tempDir, { recursive: true }).catch(() => {});
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('should initialize with default fallback flags', () => {
    const client = new FlagClient({ cacheDir: tempDir });
    assert.strictEqual(client.getFeatureFlag('enable-ai-recommendations', 'tenant-1'), true);
    assert.strictEqual(client.getFeatureFlag('strict-offline-integrity', 'tenant-1'), false);
  });

  it('should evaluate and update flags from config-service', async () => {
    globalThis.fetch = async (input, init) => {
      const body = JSON.parse(init?.body as string);
      assert.strictEqual(body.tenantId, 'tenant-1');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          flags: {
            'enable-ai-recommendations': false,
            'new-feature-enabled': true
          }
        })
      } as any;
    };

    const client = new FlagClient({ cacheDir: tempDir, configServiceUrl: 'http://mock-service' });
    await client.syncFlags('tenant-1');

    assert.strictEqual(client.getFeatureFlag('enable-ai-recommendations', 'tenant-1'), false);
    assert.strictEqual(client.getFeatureFlag('new-feature-enabled', 'tenant-1'), true);
  });

  it('should fallback to disk cache if config-service is offline', async () => {
    let callCount = 0;
    globalThis.fetch = async (input, init) => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            flags: {
              'enable-ai-recommendations': false,
              'cached-feature': true
            }
          })
        } as any;
      }
      throw new Error('Network error');
    };

    const client1 = new FlagClient({ cacheDir: tempDir, configServiceUrl: 'http://mock-service' });
    await client1.syncFlags('tenant-1');

    // Create a second client reading from the same cache directory
    const client2 = new FlagClient({ cacheDir: tempDir, configServiceUrl: 'http://mock-service' });
    
    // Trigger sync flags which throws network error, should load from cache
    try {
      await client2.syncFlags('tenant-1');
      assert.fail('Should have thrown network error');
    } catch (err: any) {
      assert.strictEqual(err.message, 'Network error');
    }

    // Assert it successfully loaded from cache file on network failure
    assert.strictEqual(client2.getFeatureFlag('enable-ai-recommendations', 'tenant-1'), false);
    assert.strictEqual(client2.getFeatureFlag('cached-feature', 'tenant-1'), true);
  });
});
