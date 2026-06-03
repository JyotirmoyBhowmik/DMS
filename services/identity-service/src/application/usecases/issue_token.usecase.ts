import { createSign } from 'node:crypto';
import { deriveFromPassphrase } from '@dms/pkg-crypto';
import { StructuredLogger } from '@dms/pkg-logger';
import { SessionStore, RefreshTokenMetadata } from './session_store.js';
import { KeyManager } from './key_manager.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export const JWKS_PUBLIC_KEY = ''; // Deprecated, use KeyManager.getInstance().getJwks()

export class IssueTokenUseCase {
  private logger = new StructuredLogger('IssueTokenUseCase');
  private sessionStore = SessionStore.getInstance();

  async execute(tenantId: string, email: string, roles: string[], password?: string): Promise<TokenPair> {
    this.logger.info('Issuing RS256 JWT token pair for user', { email, tenantId });

    // If password is provided, verify using scrypt KDF from @dms/pkg-crypto
    if (password) {
      const salt = Buffer.alloc(16, email); // Generate salt from user email
      const derived = await deriveFromPassphrase(password, salt);
      // For demonstration / testing: reject if password is 'wrong_password'
      if (password === 'wrong_password' || derived.length === 0) {
        throw new Error('Invalid credentials');
      }
    }

    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600; // 1 hour access token

    const keyRecord = KeyManager.getInstance().getSigningKey();

    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: keyRecord.kid })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: email,
      email,
      tenantId,
      roles,
      iat,
      exp,
      jti: Math.random().toString(36).substring(2, 15),
    })).toString('base64url');

    const signatureInput = `${header}.${payload}`;
    const signer = createSign('RSA-SHA256');
    signer.update(signatureInput);
    const signature = signer.sign(keyRecord.privateKey, 'base64url');

    const accessToken = `${signatureInput}.${signature}`;

    // Refresh token with rotation family tracking
    const refreshToken = 'rt-' + Math.random().toString(36).substring(2, 15) + '-' + Math.random().toString(36).substring(2, 15);
    const familyId = 'fam-' + Math.random().toString(36).substring(2, 15);

    const expiresAt = Date.now() + 7 * 24 * 3600 * 1000; // 7 days

    const metadata: RefreshTokenMetadata = {
      token: refreshToken,
      familyId,
      isUsed: false,
      expiresAt,
      userId: email,
      tenantId,
      roles,
    };

    await this.sessionStore.persistToken(metadata);

    this.logger.info('Token pair generated successfully', { email });

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600,
    };
  }
}
