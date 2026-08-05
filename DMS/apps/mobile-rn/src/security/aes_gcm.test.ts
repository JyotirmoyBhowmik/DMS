import test from 'node:test';
import assert from 'node:assert';
import { AesGcm } from './aes_gcm.js';

void test('React Native AesGcm encryption/decryption roundtrip', () => {
  const key = Buffer.alloc(32, 'k'); // 32-byte key
  const plaintext = Buffer.from('React Native Encryption Payload');

  const sealed = AesGcm.encrypt(plaintext, key);
  assert.ok(sealed.iv);
  assert.ok(sealed.ciphertext);
  assert.ok(sealed.authTag);

  const decrypted = AesGcm.decrypt(sealed, key);
  assert.strictEqual(decrypted.toString(), 'React Native Encryption Payload');
});

void test('React Native AesGcm AAD verification', () => {
  const key = Buffer.alloc(32, 'k');
  const plaintext = Buffer.from('AAD Payload');
  const aad = Buffer.from('Tenant-123');

  const sealed = AesGcm.encrypt(plaintext, key, aad);
  const decrypted = AesGcm.decrypt(sealed, key);
  assert.strictEqual(decrypted.toString(), 'AAD Payload');

  // If AAD is tampered/changed, decryption must fail
  const badSealed = { ...sealed, aad: Buffer.from('Tenant-456') };
  assert.throws(() => {
    AesGcm.decrypt(badSealed, key);
  });
});

void test('React Native AesGcm packing and unpacking compatible format', () => {
  const key = Buffer.alloc(32, 'k');
  const plaintext = Buffer.from('Data');
  
  // Encrypt & pack
  const sealed = AesGcm.encrypt(plaintext, key);
  const token = AesGcm.pack(sealed);
  
  assert.ok(token.startsWith('v1.'));
  const parts = token.split('.');
  assert.strictEqual(parts.length, 4);

  // Unpack & decrypt
  const unpacked = AesGcm.unpack(token);
  const decrypted = AesGcm.decrypt(unpacked, key);
  assert.strictEqual(decrypted.toString(), 'Data');
});

void test('React Native AesGcm signature verification failure on tampering', () => {
  const key = Buffer.alloc(32, 'k');
  const plaintext = Buffer.from('Original Data');
  const sealed = AesGcm.encrypt(plaintext, key);

  // Tamper ciphertext
  sealed.ciphertext[0] ^= 1;
  assert.throws(() => {
    AesGcm.decrypt(sealed, key);
  });
});
