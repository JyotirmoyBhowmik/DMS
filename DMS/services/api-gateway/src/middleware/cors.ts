/**
 * CORS (Cross-Origin Resource Sharing) middleware.
 *
 * Supports:
 *  - Allowed-origins whitelist (exact match or wildcard patterns)
 *  - Configurable allowed methods, headers, and max-age
 *  - Preflight (OPTIONS) request handling
 *  - Credentials support toggle
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CorsConfig {
  /** Allowed origins. Use '*' for any origin (not recommended for production). */
  allowedOrigins: string[];
  /** HTTP methods allowed in cross-origin requests. Default: standard REST verbs */
  allowedMethods?: string[];
  /** Headers the client is allowed to send. Default: common set */
  allowedHeaders?: string[];
  /** Headers the browser is allowed to read from the response */
  exposedHeaders?: string[];
  /** Whether the browser should include credentials (cookies, auth headers). Default: false */
  allowCredentials?: boolean;
  /** Max preflight cache time in seconds. Default: 86400 (24 h) */
  maxAge?: number;
}

export interface CorsRequest {
  method: string;
  headers: Record<string, string | undefined>;
}

export interface CorsResult {
  allowed: boolean;
  headers: Record<string, string>;
  isPreflight: boolean;
}

// ─── Default Values ───────────────────────────────────────────────────────────

const DEFAULT_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const DEFAULT_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'X-Tenant-Id',
  'X-Correlation-Id',
  'Accept',
  'Origin',
];

// ─── CORS Middleware ──────────────────────────────────────────────────────────

export class CorsMiddleware {
  private readonly allowedOrigins: string[];
  private readonly allowedMethods: string[];
  private readonly allowedHeaders: string[];
  private readonly exposedHeaders: string[];
  private readonly allowCredentials: boolean;
  private readonly maxAge: number;

  constructor(config: CorsConfig) {
    this.allowedOrigins = config.allowedOrigins;
    this.allowedMethods = config.allowedMethods ?? DEFAULT_METHODS;
    this.allowedHeaders = config.allowedHeaders ?? DEFAULT_HEADERS;
    this.exposedHeaders = config.exposedHeaders ?? [];
    this.allowCredentials = config.allowCredentials ?? false;
    this.maxAge = config.maxAge ?? 86_400;
  }

  /**
   * Evaluate CORS for the given request.
   * Returns the headers that should be set on the HTTP response and whether
   * the request is allowed.
   */
  evaluate(request: CorsRequest): CorsResult {
    const origin = request.headers['origin'] ?? request.headers['Origin'];
    const isPreflight = request.method.toUpperCase() === 'OPTIONS';

    // No origin header → not a CORS request; pass through.
    if (!origin) {
      return { allowed: true, headers: {}, isPreflight: false };
    }

    const originAllowed = this.isOriginAllowed(origin);

    if (!originAllowed) {
      return { allowed: false, headers: {}, isPreflight };
    }

    const headers: Record<string, string> = {};

    // When credentials are enabled, we MUST echo the exact origin,
    // not '*'.
    headers['Access-Control-Allow-Origin'] = this.allowCredentials
      ? origin
      : this.allowedOrigins.includes('*')
        ? '*'
        : origin;

    if (this.allowCredentials) {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    if (this.exposedHeaders.length > 0) {
      headers['Access-Control-Expose-Headers'] =
        this.exposedHeaders.join(', ');
    }

    // Vary on Origin so caches don't collapse different-origin responses
    headers['Vary'] = 'Origin';

    // Preflight-specific headers
    if (isPreflight) {
      headers['Access-Control-Allow-Methods'] =
        this.allowedMethods.join(', ');
      headers['Access-Control-Allow-Headers'] =
        this.allowedHeaders.join(', ');
      headers['Access-Control-Max-Age'] = String(this.maxAge);
    }

    return { allowed: true, headers, isPreflight };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private isOriginAllowed(origin: string): boolean {
    for (const pattern of this.allowedOrigins) {
      if (pattern === '*') return true;
      if (pattern === origin) return true;

      // Wildcard subdomain: *.example.com matches sub.example.com
      if (pattern.startsWith('*.')) {
        const suffix = pattern.slice(1); // ".example.com"
        if (origin.endsWith(suffix)) return true;
        // Also allow the bare domain (example.com)
        const bare = pattern.slice(2); // "example.com"
        try {
          const url = new URL(origin);
          if (url.hostname === bare) return true;
        } catch {
          // Not a valid URL, skip
        }
      }
    }
    return false;
  }
}
