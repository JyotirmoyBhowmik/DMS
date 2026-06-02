import test from 'node:test';
import assert from 'node:assert';
import { deriveKey, deriveFromPassphrase } from './kdf.js';

test('HKDF key derivation function output validation', () => {
  const ikm = Buffer.from('input-keying-material-raw-data-1234', 'utf8');
  const salt = Buffer.from('hkdf-salt-string', 'utf8');
  const info = 'dms:symmetric-encryption-key-derivation';

  const derived = deriveKey(ikm, salt, info, 32);
  assert.ok(derived.length === 32, 'Derived key should be exactly 32 bytes');

  // Verify determinism
  const derived2 = deriveKey(ikm, salt, info, 32);
  assert.deepStrictEqual(derived, derived2, 'HKDF derivation must be fully deterministic');
});

test('deriveFromPassphrase using scrypt password hashing', async () => {
  const passphrase = 'my-super-secure-secret-password-12345';
  const salt = Buffer.alloc(16, 's'); // 16-byte salt

  const derived = await deriveFromPassphrase(passphrase, salt);
  assert.ok(derived.length === 32, 'Derived scrypt key must be 32 bytes');

  // Test that different passwords generate distinct keys
  const derivedAlt = await deriveFromPassphrase('another-password-string', salt);
  assert.notDeepStrictEqual(derived, derivedAlt, 'Distinct passphrases must derive distinct keys');
});
