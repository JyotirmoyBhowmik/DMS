import { createSign } from 'node:crypto';
import { StructuredLogger } from '@dms/pkg-logger';
import { TokenPair } from './issue_token.usecase.js';
import { RefreshTokenRepository } from '../../domain/repositories/refresh_token.repository.js';
import { RefreshToken } from '../../domain/entities/refresh_token.js';
import { loadConfigSync } from '@dms/pkg-config';
import { KeyManager } from './key_manager.js';
import type { TokenScopeClaims } from '@dms/pkg-tenant-scope';

const config = loadConfigSync();

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

    if (meta.isUsed) {
      this.logger.warn('Token reuse detected! Revoking entire family.', { familyId: meta.familyId });
      const familyTokens = await this.refreshTokenRepo.findByFamilyId(meta.familyId, tenantId);
      for (const token of familyTokens) {
        await this.refreshTokenRepo.delete(token.token, tenantId);
      }
      throw new Error('Refresh token reuse detected. Revoking family.');
    }

    meta.isUsed = true;
    await this.refreshTokenRepo.update(meta, tenantId);

    const nextRefreshToken = 'rt-' + Math.random().toString(36).substring(2, 15) + '-' + Math.random().toString(36).substring(2, 15);
    const expiresAt = Date.now() + 7 * 24 * 3600 * 1000;

    const newMeta = new RefreshToken();
    newMeta.token = nextRefreshToken;
    newMeta.familyId = meta.familyId;
    newMeta.isUsed = false;
    newMeta.expiresAt = new Date(expiresAt);
    newMeta.userId = meta.userId;
    newMeta.tenantId = tenantId;
    newMeta.roles = meta.roles;
    newMeta.scopeJson = meta.scopeJson;

    await this.refreshTokenRepo.save(newMeta, tenantId);

    const roles = meta.roles ?? ['agent'];
    let scope: TokenScopeClaims | undefined;
    if (meta.scopeJson) {
      scope = JSON.parse(meta.scopeJson) as TokenScopeClaims;
    }

    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;
    const keyRecord = KeyManager.getInstance().getSigningKey();

    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: keyRecord.kid })).toString('base64url');
    const payloadBody: Record<string, unknown> = {
      sub: meta.userId,
      email: meta.userId,
      tenantId: meta.tenantId,
      roles,
      iss: config.security.jwtIssuer,
      aud: config.security.jwtAudience,
      iat,
      exp,
      jti: Math.random().toString(36).substring(2, 15),
    };

    if (scope) {
      Object.assign(payloadBody, {
        orgType: scope.orgType,
        persona: scope.persona,
        distributorIds: scope.distributorIds,
        outletIds: scope.outletIds,
        territoryIds: scope.territoryIds,
        moduleEntitlements: scope.moduleEntitlements,
        syncProfile: scope.syncProfile,
        dataClearance: scope.dataClearance,
        erpConnectorId: scope.erpConnectorId,
      });
    }

    const payload = Buffer.from(JSON.stringify(payloadBody)).toString('base64url');
    const signatureInput = `${header}.${payload}`;
    const signer = createSign('RSA-SHA256');
    signer.update(signatureInput);
    const signature = signer.sign(keyRecord.privateKey, 'base64url');
    const accessToken = `${signatureInput}.${signature}`;

    this.logger.info('Token rotated successfully', { userId: meta.userId });

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      expiresIn: 3600,
    };
  }
}
