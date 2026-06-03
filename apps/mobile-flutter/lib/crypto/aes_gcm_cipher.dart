import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:pointycastle/export.dart';

class SealedPayload {
  final Uint8List iv;
  final Uint8List ciphertext;
  final Uint8List authTag;
  final Uint8List? aad;

  SealedPayload({
    required this.iv,
    required this.ciphertext,
    required this.authTag,
    this.aad,
  });
}

class AesGcmCipher {
  static const int ivLength = 12;
  static const int tagLength = 16;
  static const int keyLength = 32;
  static const String packVersion = 'v1';

  /**
   * Encrypt plaintext using AES-256-GCM.
   */
  static SealedPayload encrypt(Uint8List plaintext, Uint8List key, {Uint8List? aad}) {
    if (key.length != keyLength) {
      throw ArgumentError('Invalid key length: expected $keyLength bytes');
    }

    final random = Random.secure();
    final iv = Uint8List(ivLength);
    for (var i = 0; i < ivLength; i++) {
      iv[i] = random.nextInt(256);
    }

    final cipher = GCMBlockCipher(AESEngine());
    final params = AEADParameters(
      KeyParameter(key),
      tagLength * 8,
      iv,
      aad ?? Uint8List(0),
    );

    cipher.init(true, params);

    final out = Uint8List(cipher.getOutputSize(plaintext.length));
    var len = cipher.processBytes(plaintext, 0, plaintext.length, out, 0);
    len += cipher.doFinal(out, len);

    // Slice the ciphertext and tag from the output
    // GCM block cipher in PointyCastle appends the tag to the output
    final ciphertextLen = out.length - tagLength;
    final ciphertext = out.sublist(0, ciphertextLen);
    final authTag = out.sublist(ciphertextLen);

    return SealedPayload(
      iv: iv,
      ciphertext: ciphertext,
      authTag: authTag,
      aad: aad,
    );
  }

  /**
   * Decrypt a SealedPayload using AES-256-GCM.
   */
  static Uint8List decrypt(SealedPayload sealed, Uint8List key) {
    if (key.length != keyLength) {
      throw ArgumentError('Invalid key length: expected $keyLength bytes');
    }

    final cipher = GCMBlockCipher(AESEngine());
    final params = AEADParameters(
      KeyParameter(key),
      tagLength * 8,
      sealed.iv,
      sealed.aad ?? Uint8List(0),
    );

    cipher.init(false, params);

    // Concatenate ciphertext and tag back together for decryption
    final input = Uint8List(sealed.ciphertext.length + sealed.authTag.length);
    input.setAll(0, sealed.ciphertext);
    input.setAll(sealed.ciphertext.length, sealed.authTag);

    try {
      final out = Uint8List(cipher.getOutputSize(input.length));
      var len = cipher.processBytes(input, 0, input.length, out, 0);
      cipher.doFinal(out, len);
      return out.sublist(0, out.length - tagLength); // Exclude the tag from output
    } catch (e) {
      throw Exception('AES-GCM decryption failed: authentication tag verification failed');
    }
  }

  /**
   * Serialize SealedPayload to compact string token.
   */
  static String pack(SealedPayload sealed) {
    final ivB64 = base64UrlEncodeWithoutPadding(sealed.iv);
    final ctB64 = base64UrlEncodeWithoutPadding(sealed.ciphertext);
    final tagB64 = base64UrlEncodeWithoutPadding(sealed.authTag);
    return '$packVersion.$ivB64.$ctB64.$tagB64';
  }

  /**
   * Deserialize a compact token string back into a SealedPayload.
   */
  static SealedPayload unpack(String token) {
    final parts = token.split('.');
    if (parts.length != 4) {
      throw ArgumentError('Invalid sealed token format: expected 4 parts, got ${parts.length}');
    }

    final version = parts[0];
    if (version != packVersion) {
      throw ArgumentError('Unsupported token version: "$version"');
    }

    final iv = base64UrlDecodeWithoutPadding(parts[1]);
    final ciphertext = base64UrlDecodeWithoutPadding(parts[2]);
    final authTag = base64UrlDecodeWithoutPadding(parts[3]);

    if (iv.length != ivLength) {
      throw ArgumentError('Invalid IV length: expected $ivLength, got ${iv.length}');
    }
    if (authTag.length != tagLength) {
      throw ArgumentError('Invalid auth tag length: expected $tagLength, got ${authTag.length}');
    }

    return SealedPayload(
      iv: iv,
      ciphertext: ciphertext,
      authTag: authTag,
    );
  }

  static String base64UrlEncodeWithoutPadding(Uint8List data) {
    return base64Url.encode(data).replaceAll('=', '');
  }

  static Uint8List base64UrlDecodeWithoutPadding(String str) {
    var normalized = str;
    // Restore padding if needed
    final remainder = str.length % 4;
    if (remainder == 2) {
      normalized += '==';
    } else if (remainder == 3) {
      normalized += '=';
    }
    return Uint8List.fromList(base64Url.decode(normalized));
  }
}
