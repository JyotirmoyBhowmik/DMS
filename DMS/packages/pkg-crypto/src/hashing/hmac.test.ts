import test from 'node:test';
import assert from 'node:assert';
import { hmacSha256, verifyHmac, canonicalRequestString } from './hmac.js';

test('hmacSha256 generation and timing-safe verifyHmac validation', () => {
  const message = 'Verification message';
  const key = Buffer.alloc(32, 'k');

  const hash = hmacSha256(message, key);
  assert.ok(hash.length === 32, 'HMAC-SHA256 output must be 32 bytes');

  // Verify true match
  const verified = verifyHmac(message, key, hash);
  assert.strictEqual(verified, true, 'verifyHmac must return true for correct signature');

  // Verify false mismatch (tampered message)
  const falseVerified = verifyHmac('Verification message altered', key, hash);
  assert.strictEqual(falseVerified, false, 'verifyHmac must return false for modified messages');
});

test('canonicalRequestString serialization', () => {
  const parts = {
    method: 'GET',
    path: '/api/v1/orders/',
    query: '?limit=10&offset=0',
    body: '{"foo":"bar"}',
    timestamp: '1717000000',
    nonce: 'nonce-uuid-1234'
  };

  const canonical = canonicalRequestString(parts);
  
  // Verify method is capitalized, path is normalized, query params normalized
  const lines = canonical.split('\n');
  assert.strictEqual(lines[0], 'GET');
  assert.strictEqual(lines[1], '/api/v1/orders'); // trimmed trailing slash
  assert.strictEqual(lines[2], 'limit=10&offset=0'); // alphabetical query params
  assert.strictEqual(lines[4], '1717000000');
  assert.strictEqual(lines[5], 'nonce-uuid-1234');
});
