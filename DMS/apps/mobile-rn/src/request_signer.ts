import { createHmac } from 'crypto';

export interface CanonicalRequestParts {
  method: string;
  path: string;
  query: string;
  body: string;
  timestamp: string;
  nonce: string;
}

/**
 * Build a canonical request string byte-identical to the server TypeScript code.
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

/**
 * Sign canonical headers with a client-side key.
 */
export function signRequest(parts: CanonicalRequestParts, secretKeyHex: string): string {
  const canonical = canonicalRequestString(parts);
  const key = Buffer.from(secretKeyHex, 'hex');
  return createHmac('sha256', key).update(canonical).digest('hex');
}
