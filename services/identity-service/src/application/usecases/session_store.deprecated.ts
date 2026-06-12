import { StructuredLogger } from '@dms/pkg-logger';

export interface RefreshTokenMetadata {
  token: string;
  familyId: string;
  isUsed: boolean;
  expiresAt: number;
  userId: string;
  tenantId: string;
  roles: string[];
}

export class SessionStore {
  private static instance: SessionStore;
  private logger = new StructuredLogger('SessionStore');

  // Map of refresh token -> metadata
  private tokens = new Map<string, RefreshTokenMetadata>();
  // Map of familyId -> set of active/revoked tokens
  private families = new Map<string, Set<string>>();

  private constructor() {}

  static getInstance(): SessionStore {
    if (!SessionStore.instance) {
      SessionStore.instance = new SessionStore();
    }
    return SessionStore.instance;
  }

  async persistToken(metadata: RefreshTokenMetadata): Promise<void> {
    this.tokens.set(metadata.token, metadata);
    if (!this.families.has(metadata.familyId)) {
      this.families.set(metadata.familyId, new Set());
    }
    this.families.get(metadata.familyId)!.add(metadata.token);
    this.logger.info('Refresh token persisted', { token: metadata.token.substring(0, 10) + '...', familyId: metadata.familyId });
  }

  async findToken(token: string): Promise<RefreshTokenMetadata | undefined> {
    return this.tokens.get(token);
  }

  async rotateToken(oldToken: string, newToken: string, newExpiresAt: number): Promise<RefreshTokenMetadata> {
    const meta = this.tokens.get(oldToken);
    if (!meta) {
      throw new Error('Token not found');
    }

    if (meta.isUsed) {
      // Reuse detected! Revoke the entire family!
      this.logger.warn('Token reuse detected! Revoking entire family.', { familyId: meta.familyId });
      await this.revokeFamily(meta.familyId);
      throw new Error('Refresh token reuse detected. Revoking family.');
    }

    // Mark old as used
    meta.isUsed = true;

    // Create new token under same family
    const newMeta: RefreshTokenMetadata = {
      token: newToken,
      familyId: meta.familyId,
      isUsed: false,
      expiresAt: newExpiresAt,
      userId: meta.userId,
      tenantId: meta.tenantId,
      roles: meta.roles,
    };

    await this.persistToken(newMeta);
    return newMeta;
  }

  async revokeFamily(familyId: string): Promise<void> {
    const familyTokens = this.families.get(familyId);
    if (familyTokens) {
      for (const token of familyTokens) {
        this.tokens.delete(token);
      }
      this.families.delete(familyId);
      this.logger.warn('Token family completely revoked', { familyId });
    }
  }

  clearAll(): void {
    this.tokens.clear();
    this.families.clear();
  }
}
