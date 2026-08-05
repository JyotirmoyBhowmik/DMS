import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_flutter/crypto/request_signer.dart';
import 'package:mobile_flutter/crypto/aes_gcm_cipher.dart';

void main() {
  group('Flutter RequestSigner Tests', () {
    test('canonicalRequestString matches spec', () {
      final parts = CanonicalRequestParts(
        method: 'GET',
        path: '/api/v1/orders/',
        query: 'sort=desc&limit=10',
        body: '{"foo":"bar"}',
        timestamp: '1710000000',
        nonce: 'nonce123',
      );

      final canonical = RequestSigner.canonicalRequestString(parts);
      final lines = canonical.split('\n');

      expect(lines.length, 6);
      expect(lines[0], 'GET');
      expect(lines[1], '/api/v1/orders'); // Normalized path (trailing slash removed)
      expect(lines[2], 'limit=10&sort=desc'); // Sorted query parameters
      expect(lines[4], '1710000000');
      expect(lines[5], 'nonce123');
    });

    test('signRequest creates valid HMAC-SHA256 signature', () {
      final parts = CanonicalRequestParts(
        method: 'POST',
        path: '/orders',
        query: '',
        body: '{}',
        timestamp: '1710000000',
        nonce: 'nonce',
      );
      final secretKeyHex = '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';
      
      final signature = RequestSigner.signRequest(parts, secretKeyHex);
      expect(signature.length, 64); // Hex-encoded SHA-256 is 64 chars
    });
  });

  group('Flutter AesGcmCipher Tests', () {
    final key = Uint8List.fromList(List<int>.generate(32, (i) => i)); // 32-byte key
    final plaintext = utf8.encode('Hello Enterprise DMS GCM');

    test('Encryption & Decryption Roundtrip', () {
      final sealed = AesGcmCipher.encrypt(Uint8List.fromList(plaintext), key);
      expect(sealed.iv.length, 12);
      expect(sealed.ciphertext.length, plaintext.length);
      expect(sealed.authTag.length, 16);

      final decrypted = AesGcmCipher.decrypt(sealed, key);
      expect(utf8.decode(decrypted), 'Hello Enterprise DMS GCM');
    });

    test('Pack & Unpack compatibility', () {
      final sealed = AesGcmCipher.encrypt(Uint8List.fromList(plaintext), key);
      final token = AesGcmCipher.pack(sealed);

      expect(token.startsWith('v1.'), isTrue);
      
      final unpacked = AesGcmCipher.unpack(token);
      expect(unpacked.iv, sealed.iv);
      expect(unpacked.ciphertext, sealed.ciphertext);
      expect(unpacked.authTag, sealed.authTag);

      final decrypted = AesGcmCipher.decrypt(unpacked, key);
      expect(utf8.decode(decrypted), 'Hello Enterprise DMS GCM');
    });

    test('Decryption fails with tampered auth tag', () {
      final sealed = AesGcmCipher.encrypt(Uint8List.fromList(plaintext), key);
      sealed.ciphertext[0] ^= 1; // Tamper

      expect(() => AesGcmCipher.decrypt(sealed, key), throwsException);
    });
  });
}
