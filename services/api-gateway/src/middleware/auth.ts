/**
 * JWT verification middleware for RS256-signed tokens.
 *
 * This middleware:
 *  1. Extracts the Bearer token from the Authorization header
 *  2. Decodes the JWT header + payload (base64url)
 *  3. Verifies the RS256 signature using Node.js native `crypto`
 *  4. Checks standard claims: exp, nbf, iss, aud
 *  5. Extracts tenant_id and roles from the payload
 *
 * The middleware does NOT depend on external JWT libraries – it uses
 * only the Node.js built-in `crypto` module for `createVerify`.
 */

import { createVerify } from 'node:crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JwtConfig {
  /** PEM-encoded RSA public key (or JWKS-fetched key) for RS256 verification */
  publicKey?: string;
  /** Resolver function to fetch a public key dynamically by Key ID (kid) */
  publicKeyResolver?: (kid: string) => Promise<string | null> | (string | null);
  /** Expected `iss` (issuer) claim.  Skipped if not set. */
  issuer?: string;
  /** Expected `aud` (audience) claim.  Skipped if not set. */
  audience?: string;
  /** Clock skew tolerance in seconds for exp/nbf checks. Default: 30 */
  clockSkewSeconds?: number;
  /** Header name for the Authorization header. Default: "authorization" */
  authHeader?: string;
}

export interface JwtPayload {
  /** Subject (user ID) */
  sub: string;
  /** Tenant ID */
  tenantId: string;
  /** Roles / scopes */
  roles: string[];
  /** Issued at (epoch seconds) */
  iat: number;
  /** Expiration (epoch seconds) */
  exp: number;
  /** Not before (epoch seconds) */
  nbf?: number;
  /** Issuer */
  iss?: string;
  /** Audience */
  aud?: string | string[];
  /** Any extra claims */
  [key: string]: unknown;
}

export interface AuthResult {
  authenticated: boolean;
  payload?: JwtPayload;
  error?: string;
  errorCode?: AuthErrorCode;
}

export type AuthErrorCode =
  | 'MISSING_TOKEN'
  | 'MALFORMED_TOKEN'
  | 'INVALID_ALGORITHM'
  | 'INVALID_SIGNATURE'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_NOT_YET_VALID'
  | 'INVALID_ISSUER'
  | 'INVALID_AUDIENCE'
  | 'MISSING_CLAIMS';

export interface AuthenticatableRequest {
  headers: Record<string, string | undefined>;
}

// ─── JWT Auth Middleware ──────────────────────────────────────────────────────

export class JwtAuthMiddleware {
  private readonly publicKey?: string;
  private readonly publicKeyResolver?: (kid: string) => Promise<string | null> | (string | null);
  private readonly issuer?: string;
  private readonly audience?: string;
  private readonly clockSkew: number;
  private readonly authHeader: string;

  constructor(config: JwtConfig) {
    this.publicKey = config.publicKey;
    this.publicKeyResolver = config.publicKeyResolver;
    this.issuer = config.issuer;
    this.audience = config.audience;
    this.clockSkew = config.clockSkewSeconds ?? 30;
    this.authHeader = (config.authHeader ?? 'authorization').toLowerCase();
  }

  /**
   * Verify the JWT on the incoming request.
   */
  async verify(request: AuthenticatableRequest): Promise<AuthResult> {
    // 1. Extract token
    const authValue = this.getHeader(request, this.authHeader);
    if (!authValue) {
      return this.fail('MISSING_TOKEN', 'Authorization header is missing');
    }

    const parts = authValue.split(' ');
    if (parts.length !== 2 || parts[0]!.toLowerCase() !== 'bearer') {
      return this.fail(
        'MALFORMED_TOKEN',
        'Authorization header must be: Bearer <token>',
      );
    }
    const token = parts[1]!;

    // 2. Split token
    const segments = token.split('.');
    if (segments.length !== 3) {
      return this.fail('MALFORMED_TOKEN', 'JWT must have 3 segments');
    }

    const [headerB64, payloadB64, signatureB64] = segments as [
      string,
      string,
      string,
    ];

    // 3. Decode header
    let header: { alg: string; typ?: string; kid?: string };
    try {
      header = JSON.parse(base64UrlDecode(headerB64));
    } catch {
      return this.fail('MALFORMED_TOKEN', 'Invalid JWT header encoding');
    }

    if (header.alg !== 'RS256') {
      return this.fail(
        'INVALID_ALGORITHM',
        `Unsupported algorithm: ${header.alg}. Only RS256 is accepted.`,
      );
    }

    // Resolve key using resolver or fallback
    let keyToUse = this.publicKey;
    if (header.kid && this.publicKeyResolver) {
      try {
        const resolved = await this.publicKeyResolver(header.kid);
        if (resolved) {
          keyToUse = resolved;
        }
      } catch (err: unknown) {
        return this.fail('INVALID_SIGNATURE', `Key resolution error: ${(err as Error).message}`);
      }
    }

    if (!keyToUse) {
      return this.fail('INVALID_SIGNATURE', 'Public key could not be resolved');
    }

    // 4. Verify RS256 signature
    try {
      const signInput = `${headerB64}.${payloadB64}`;
      const signatureBuffer = Buffer.from(signatureB64, 'base64url');

      const verifier = createVerify('RSA-SHA256');
      verifier.update(signInput);
      const valid = verifier.verify(keyToUse, signatureBuffer);

      if (!valid) {
        return this.fail('INVALID_SIGNATURE', 'JWT signature verification failed');
      }
    } catch {
      return this.fail('INVALID_SIGNATURE', 'JWT signature verification failed');
    }

    // 5. Decode payload
    let payload: JwtPayload;
    try {
      payload = JSON.parse(base64UrlDecode(payloadB64));
    } catch {
      return this.fail('MALFORMED_TOKEN', 'Invalid JWT payload encoding');
    }

    // 6. Validate standard claims
    const now = Math.floor(Date.now() / 1000);

    // exp
    if (payload.exp !== undefined) {
      if (now > payload.exp + this.clockSkew) {
        return this.fail('TOKEN_EXPIRED', 'Token has expired');
      }
    }

    // nbf
    if (payload.nbf !== undefined) {
      if (now < payload.nbf - this.clockSkew) {
        return this.fail('TOKEN_NOT_YET_VALID', 'Token is not yet valid');
      }
    }

    // iss
    if (this.issuer && payload.iss !== this.issuer) {
      return this.fail(
        'INVALID_ISSUER',
        `Expected issuer "${this.issuer}", got "${payload.iss}"`,
      );
    }

    // aud
    if (this.audience) {
      const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!auds.includes(this.audience)) {
        return this.fail(
          'INVALID_AUDIENCE',
          `Expected audience "${this.audience}", got "${payload.aud}"`,
        );
      }
    }

    // 7. Required custom claims
    if (!payload.sub) {
      return this.fail('MISSING_CLAIMS', 'Token is missing "sub" claim');
    }
    if (!payload.tenantId) {
      return this.fail('MISSING_CLAIMS', 'Token is missing "tenantId" claim');
    }

    return { authenticated: true, payload };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private fail(code: AuthErrorCode, message: string): AuthResult {
    return { authenticated: false, error: message, errorCode: code };
  }

  private getHeader(
    request: AuthenticatableRequest,
    name: string,
  ): string | undefined {
    // Headers may be stored in any casing
    const lower = name.toLowerCase();
    for (const [key, value] of Object.entries(request.headers)) {
      if (key.toLowerCase() === lower) return value;
    }
    return undefined;
  }
}

// ─── base64url helpers ────────────────────────────────────────────────────────

function base64UrlDecode(input: string): string {
  // Replace base64url chars, add padding
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf-8');
}
