import test from 'node:test';
import assert from 'node:assert';
import { PostgresDatabaseClient, InMemoryDriver } from './client.js';
import { InMemoryCacheClient } from '../cache/cache-client.js';

test('PostgresDatabaseClient: Query Caching Unit Tests', async (t) => {
  const driver = new InMemoryDriver();
  const client = new PostgresDatabaseClient({}, driver);
  const cache = new InMemoryCacheClient();

  client.setCacheClient(cache);

  // Set query mock handler
  let queryCount = 0;
  driver.queryHandler = (sql, params) => {
    queryCount++;
    if (sql === 'SELECT name FROM products WHERE id = $1') {
      return {
        rows: [{ name: 'Cached Product' }],
        rowCount: 1,
      };
    }
    return undefined;
  };

  await t.test('First query should hit database and populate cache', async () => {
    queryCount = 0;
    await cache.clear();

    const cacheOpts = { key: 'product:123', ttlSeconds: 10 };
    const result = await client.query<{ name: string }>(
      'SELECT name FROM products WHERE id = $1',
      ['123'],
      undefined,
      cacheOpts
    );

    assert.strictEqual(result.rows[0].name, 'Cached Product');
    assert.strictEqual(queryCount, 1, 'Should have queried driver');

    // Inspect cache directly
    const cachedVal = await cache.get<any>('product:123');
    assert.ok(cachedVal, 'Value should be stored in cache');
    assert.strictEqual(cachedVal.rows[0].name, 'Cached Product');
  });

  await t.test('Subsequent query should return from cache directly', async () => {
    queryCount = 0;

    const cacheOpts = { key: 'product:123', ttlSeconds: 10 };
    const result = await client.query<{ name: string }>(
      'SELECT name FROM products WHERE id = $1',
      ['123'],
      undefined,
      cacheOpts
    );

    assert.strictEqual(result.rows[0].name, 'Cached Product');
    assert.strictEqual(queryCount, 0, 'Should NOT have queried driver (cache hit)');
  });

  await t.test('Query should hit database again if cache is cleared or expired', async () => {
    queryCount = 0;
    await cache.clear();

    const cacheOpts = { key: 'product:123', ttlSeconds: 10 };
    const result = await client.query<{ name: string }>(
      'SELECT name FROM products WHERE id = $1',
      ['123'],
      undefined,
      cacheOpts
    );

    assert.strictEqual(result.rows[0].name, 'Cached Product');
    assert.strictEqual(queryCount, 1, 'Should query database again');
  });
});
