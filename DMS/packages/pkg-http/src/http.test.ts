import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { ResilientHttpClient, CircuitBreaker, RetryPolicy } from './index.js';

describe('HTTP Resilient Client Tests', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('CircuitBreaker state transitions under failures', () => {
    // failureThreshold = 3, cooldown = 100ms for testing
    const cb = new CircuitBreaker(3, 100);

    assert.strictEqual(cb.getState(), 'CLOSED');

    cb.recordFailure();
    cb.recordFailure();
    assert.strictEqual(cb.getState(), 'CLOSED'); // 2 failures

    cb.recordFailure();
    assert.strictEqual(cb.getState(), 'OPEN'); // 3 failures, trips to OPEN

    // In open state, request is blocked
    assert.strictEqual(cb.getState(), 'OPEN');
  });

  it('CircuitBreaker cooldown transitions to HALF_OPEN and resets on success', async () => {
    const cb = new CircuitBreaker(2, 50);
    cb.recordFailure();
    cb.recordFailure();
    assert.strictEqual(cb.getState(), 'OPEN');

    // Wait for cooldown
    await new Promise(resolve => setTimeout(resolve, 60));
    assert.strictEqual(cb.getState(), 'HALF_OPEN');

    cb.recordSuccess();
    assert.strictEqual(cb.getState(), 'CLOSED');
  });

  it('CircuitBreaker cooldown transitions to HALF_OPEN and trips back on failure', async () => {
    const cb = new CircuitBreaker(2, 50);
    cb.recordFailure();
    cb.recordFailure();
    assert.strictEqual(cb.getState(), 'OPEN');

    // Wait for cooldown
    await new Promise(resolve => setTimeout(resolve, 60));
    assert.strictEqual(cb.getState(), 'HALF_OPEN');

    cb.recordFailure();
    assert.strictEqual(cb.getState(), 'OPEN');
  });

  it('RetryPolicy evaluates idempotency correctly', () => {
    const retry = new RetryPolicy();

    assert.strictEqual(retry.isIdempotent('GET', {}), true);
    assert.strictEqual(retry.isIdempotent('PUT', {}), true);
    assert.strictEqual(retry.isIdempotent('DELETE', {}), true);
    assert.strictEqual(retry.isIdempotent('POST', {}), false);
    assert.strictEqual(retry.isIdempotent('POST', { 'x-idempotency-key': 'test' }), true);
  });

  it('ResilientHttpClient runs request successfully', async () => {
    globalThis.fetch = async (input, init) => {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ ok: true })
      } as any;
    };

    const client = new ResilientHttpClient();
    const res = await client.request('http://localhost/test', { method: 'GET' });
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.data, { ok: true });
  });
});
