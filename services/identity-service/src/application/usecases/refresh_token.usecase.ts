import { generateKeyPairSync, createSign } from 'node:crypto';
import { StructuredLogger } from '@dms/pkg-logger';
import { SessionStore } from './session_store.js';
import { TokenPair } from './issue_token.usecase.js';

// Re-use key generation logic or load from same private key context
// In a real app we'd load these from a secure store, but since we are doing RS256 signing,
// we can generate a key pair or reuse the signing context.
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

export class RefreshTokenUseCase {
  private logger = new StructuredLogger('RefreshTokenUseCase');
  private sessionStore = SessionStore.getInstance();

  async execute(refreshToken: string): Promise<TokenPair> {
    this.logger.info('Refresh token request received');

    const meta = await this.sessionStore.findToken(refreshToken);
    if (!meta) {
      throw new Error('Invalid refresh token');
    }

    if (meta.expiresAt < Date.now()) {
      throw new Error('Refresh token has expired');
    }

    // Generate new refresh token in the same family
    const nextRefreshToken = 'rt-' + Math.random().toString(36).substring(2, 15) + '-' + Math.random().toString(36).substring(2, 15);
    const expiresAt = Date.now() + 7 * 24 * 3600 * 1000; // 7 days

    // Rotate (checks for reuse internally and throws/revokes)
    await this.sessionStore.rotateToken(refreshToken, nextRefreshToken, expiresAt);

    // Issue new access token
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;

    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: meta.userId,
      email: meta.userId,
      tenantId: meta.tenantId,
      roles: meta.roles,
      iat,
      exp,
      jti: Math.random().toString(36).substring(2, 15),
    })).toString('base64url');

    const signatureInput = `${header}.${payload}`;
    const signer = createSign('RSA-SHA256');
    signer.update(signatureInput);
    const signature = signer.sign(privateKey, 'base64url');

    const accessToken = `${signatureInput}.${signature}`;

    this.logger.info('Token rotated successfully', { userId: meta.userId });

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      expiresIn: 3600,
    };
  }
}
