import { generateKeyPairSync, createSign } from 'node:crypto';
import { StructuredLogger } from '@dms/pkg-logger';
import { TokenPair } from './issue_token.usecase.js';
import { RefreshTokenRepository } from '../../domain/repositories/refresh_token.repository.js';
import { RefreshToken } from '../../domain/entities/refresh_token.js';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

// Re-use key generation logic or load from same private key context
// In a real app we'd load these from a secure store, but since we are doing RS256 signing,
// we can generate a key pair or reuse the signing context.
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

export class RefreshTokenUseCase {
  private logger = new StructuredLogger('RefreshTokenUseCase');

  constructor(private refreshTokenRepo: RefreshTokenRepository) {}

  async execute(refreshToken: string, tenantId: string): Promise<TokenPair> {
    this.logger.info('Refresh token request received');

    const meta = await this.refreshTokenRepo.findByToken(refreshToken, tenantId);
    if (!meta) {
      throw new Error('Invalid refresh token');
    }

    if (meta.expiresAt.getTime() < Date.now()) {
      throw new Error('Refresh token has expired');
    }

    // Check for reuse
    if (meta.isUsed) {
      this.logger.warn('Token reuse detected! Revoking entire family.', { familyId: meta.familyId });
      // Revoke family
      const familyTokens = await this.refreshTokenRepo.findByFamilyId(meta.familyId, tenantId);
      for (const token of familyTokens) {
        await this.refreshTokenRepo.delete(token.token, tenantId);
      }
      throw new Error('Refresh token reuse detected. Revoking family.');
    }

    // Mark old as used
    meta.isUsed = true;
    await this.refreshTokenRepo.update(meta, tenantId);

    // Generate new refresh token in the same family
    const nextRefreshToken = 'rt-' + Math.random().toString(36).substring(2, 15) + '-' + Math.random().toString(36).substring(2, 15);
    const expiresAt = Date.now() + 7 * 24 * 3600 * 1000; // 7 days

    const newMeta = new RefreshToken();
    newMeta.token = nextRefreshToken;
    newMeta.familyId = meta.familyId;
    newMeta.isUsed = false;
    newMeta.expiresAt = new Date(expiresAt);
    newMeta.userId = meta.userId;
    newMeta.tenantId = tenantId;

    await this.refreshTokenRepo.save(newMeta, tenantId);

    // Issue new access token
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;

    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: meta.userId,
      email: meta.userId,
      tenantId: meta.tenantId,
      roles: ['agent'], // Should normally come from User/Role domains
      iss: config.security.jwtIssuer,
      aud: config.security.jwtAudience,
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
