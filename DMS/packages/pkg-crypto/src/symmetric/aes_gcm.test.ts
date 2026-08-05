import test from 'node:test';
import assert from 'node:assert';
import { AesGcmCipher } from './aes_gcm.js';
import { InMemoryKeyProvider } from '../keys/vault_client.js';
import { IntegrityError, CryptoError } from '../errors.js';

test('AesGcmCipher symmetric encryption round-trip', async () => {
  const keyProvider = new InMemoryKeyProvider({
    'test-key': Buffer.alloc(32, 'a')
  }, 'test-key');
  const cipher = new AesGcmCipher(keyProvider);

  const plaintext = Buffer.from('Antigravity Secure Payload Data', 'utf8');

  // Encrypt
  const sealed = await cipher.encrypt(plaintext, { keyId: 'test-key' });
  assert.ok(sealed.iv.length === 12, 'IV should be 12 bytes');
  assert.ok(sealed.authTag.length === 16, 'Auth tag should be 16 bytes');

  // Decrypt
  const decrypted = await cipher.decrypt(sealed, { keyId: 'test-key' });
  assert.strictEqual(decrypted.toString('utf8'), 'Antigravity Secure Payload Data', 'Plaintext should match after roundtrip');
});

test('AesGcmCipher pack and unpack serialization', async () => {
  const keyProvider = new InMemoryKeyProvider({
    'test-key': Buffer.alloc(32, 'a')
  }, 'test-key');
  const cipher = new AesGcmCipher(keyProvider);

  const plaintext = Buffer.from('Packed Verification', 'utf8');

  const sealed = await cipher.encrypt(plaintext, { keyId: 'test-key' });
  const token = AesGcmCipher.pack(sealed);

  assert.ok(token.startsWith('v1.'), 'Serialized token must start with version prefix');

  const unpacked = AesGcmCipher.unpack(token);
  assert.deepStrictEqual(unpacked.iv, sealed.iv);
  assert.deepStrictEqual(unpacked.ciphertext, sealed.ciphertext);
  assert.deepStrictEqual(unpacked.authTag, sealed.authTag);

  const decrypted = await cipher.decrypt(unpacked, { keyId: 'test-key' });
  assert.strictEqual(decrypted.toString('utf8'), 'Packed Verification');
});

test('AesGcmCipher detects tampered authentication tag', async () => {
  const keyProvider = new InMemoryKeyProvider({
    'test-key': Buffer.alloc(32, 'a')
  }, 'test-key');
  const cipher = new AesGcmCipher(keyProvider);

  const plaintext = Buffer.from('Sensitive Info', 'utf8');
  const sealed = await cipher.encrypt(plaintext, { keyId: 'test-key' });

  // Tamper with the auth tag (flip last byte)
  sealed.authTag[15] ^= 0xFF;

  await assert.rejects(
    cipher.decrypt(sealed, { keyId: 'test-key' }),
    (err: unknown) => {
      return err instanceof IntegrityError && err.message.includes('tag verification failed');
    },
    'Should throw IntegrityError if tag is tampered'
  );
});

test('AesGcmCipher rejects invalid key length', async () => {
  const keyProvider = new InMemoryKeyProvider({
    'invalid-key': Buffer.alloc(16, 'x')
  }, 'invalid-key');
  const cipher = new AesGcmCipher(keyProvider);

  const plaintext = Buffer.from('Plaintext', 'utf8');

  await assert.rejects(
    cipher.encrypt(plaintext, { keyId: 'invalid-key' }),
    (err: unknown) => {
      return err instanceof CryptoError && err.message.includes('Invalid key length');
    },
    'Should reject key lengths other than 32 bytes'
  );
});
