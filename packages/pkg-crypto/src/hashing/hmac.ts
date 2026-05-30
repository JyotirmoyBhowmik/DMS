import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Compute HMAC-SHA256 of a message using the given key.
 */
export function hmacSha256(message: Buffer | string, key: Buffer): Buffer {
  const msgBuf = typeof message === 'string' ? Buffer.from(message, 'utf8') : message;
  return createHmac('sha256', key).update(msgBuf).digest();
}

/**
 * Verify an HMAC-SHA256 using constant-time comparison to prevent timing attacks.
 * Returns true if the computed HMAC matches the expected value.
 */
export function verifyHmac(
  message: Buffer | string,
  key: Buffer,
  expected: Buffer
): boolean {
  const computed = hmacSha256(message, key);

  // Ensure both buffers are the same length before comparing
  if (computed.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(computed, expected);
}

export interface CanonicalRequestParts {
  method: string;
  path: string;
  query: string;
  body: string;
  timestamp: string;
  nonce: string;
}

/**
 * Build a canonical request string suitable for HMAC signing.
 * Each field is joined with newline characters in a deterministic order.
 * The query string is normalized by sorting parameters alphabetically.
 */
export function canonicalRequestString(parts: CanonicalRequestParts): string {
  const method = parts.method.toUpperCase();
  const path = normalizePath(parts.path);
  const query = normalizeQuery(parts.query);
  const bodyHash = createHmac('sha256', Buffer.alloc(32))
    .update(parts.body)
    .digest('hex');

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
 * Normalize a URL path: ensure leading slash, remove trailing slash, collapse double slashes.
 */
function normalizePath(path: string): string {
  let normalized = path.replace(/\/+/g, '/');
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * Normalize a query string: sort parameters alphabetically, re-encode consistently.
 */
function normalizeQuery(query: string): string {
  const cleaned = query.startsWith('?') ? query.slice(1) : query;
  if (!cleaned) {
    return '';
  }

  const params = cleaned.split('&').filter(Boolean);
  const pairs: Array<[string, string]> = params.map((p) => {
    const eqIndex = p.indexOf('=');
    if (eqIndex === -1) {
      return [decodeURIComponent(p), ''] as [string, string];
    }
    return [
      decodeURIComponent(p.slice(0, eqIndex)),
      decodeURIComponent(p.slice(eqIndex + 1)),
    ] as [string, string];
  });

  pairs.sort((a, b) => {
    const keyCompare = a[0].localeCompare(b[0]);
    if (keyCompare !== 0) return keyCompare;
    return a[1].localeCompare(b[1]);
  });

  return pairs
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}
