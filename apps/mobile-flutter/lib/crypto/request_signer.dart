import 'dart:convert';
import 'package:crypto/crypto.dart';

class CanonicalRequestParts {
  final String method;
  final String path;
  final String query;
  final String body;
  final String timestamp;
  final String nonce;

  CanonicalRequestParts({
    required this.method,
    required this.path,
    required this.query,
    required this.body,
    required this.timestamp,
    required this.nonce,
  });
}

class RequestSigner {
  /**
   * Build a canonical request string byte-identical to the server TypeScript code.
   */
  static String canonicalRequestString(CanonicalRequestParts parts) {
    final method = parts.method.toUpperCase();
    final path = _normalizePath(parts.path);
    final query = _normalizeQuery(parts.query);
    
    // Body hash is hmac-sha256 with 32 zero bytes as key
    final zeroKey = List<int>.filled(32, 0);
    final hmac = Hmac(sha256, zeroKey);
    final bodyHash = hmac.convert(utf8.encode(parts.body)).toString();

    return [
      method,
      path,
      query,
      bodyHash,
      parts.timestamp,
      parts.nonce,
    ].join('\n');
  }

  /**
   * Sign canonical headers with a client-side key.
   */
  static String signRequest(CanonicalRequestParts parts, String secretKeyHex) {
    final canonical = canonicalRequestString(parts);
    final key = _hexDecode(secretKeyHex);
    final hmac = Hmac(sha256, key);
    return hmac.convert(utf8.encode(canonical)).toString();
  }

  static String _normalizePath(String path) {
    var normalized = path.replaceAll(RegExp(r'/+'), '/');
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.substring(0, normalized.length - 1);
    }
    return normalized;
  }

  static String _normalizeQuery(String query) {
    final cleaned = query.startsWith('?') ? query.substring(1) : query;
    if (cleaned.isEmpty) {
      return '';
    }

    final params = cleaned.split('&').where((p) => p.isNotEmpty).toList();
    final pairs = params.map((p) {
      final eqIndex = p.indexOf('=');
      if (eqIndex == -1) {
        return MapEntry(Uri.decodeComponent(p), '');
      }
      return MapEntry(
        Uri.decodeComponent(p.substring(0, eqIndex)),
        Uri.decodeComponent(p.substring(eqIndex + 1)),
      );
    }).toList();

    // Sort parameters alphabetically
    pairs.sort((a, b) {
      final keyCompare = a.key.compareTo(b.key);
      if (keyCompare != 0) return keyCompare;
      return a.value.compareTo(b.value);
    });

    return pairs
        .map((p) => '${Uri.encodeComponent(p.key)}=${Uri.encodeComponent(p.value)}')
        .join('&');
  }

  static List<int> _hexDecode(String hex) {
    final result = <int>[];
    for (var i = 0; i < hex.length; i += 2) {
      result.add(int.parse(hex.substring(i, i + 2), radix: 16));
    }
    return result;
  }
}
