import { createHash, randomBytes } from 'node:crypto';
import { Logger } from '@dms/pkg-logger';
import { ApiKey } from '../../domain/entities/index.js';
import type { RateLimitConfig } from '../../domain/entities/index.js';
import type { IApiKeyRepository } from '../ports/api_key.repository.js';

/**
 * Input for creating a new API key.
 */
export interface CreateApiKeyInput {
  readonly tenantId: string;
  readonly name: string;
  readonly permissions?: string[];
  readonly rateLimit?: Partial<RateLimitConfig>;
  readonly expiresAt?: Date | null;
  readonly createdBy: string;
}

/**
 * Result of API key creation, containing the entity and the raw (unhashed) key.
 */
export interface CreateApiKeyResult {
  readonly apiKey: ApiKey;
  readonly rawKey: string;
}

/**
 * ManageApiKeysUseCase handles the lifecycle of API keys:
 * creation, revocation, rotation, and listing.
 */
export class ManageApiKeysUseCase {
  private readonly apiKeyRepository: IApiKeyRepository;
  private readonly logger: Logger;

  constructor(apiKeyRepository: IApiKeyRepository, logger: Logger) {
    this.apiKeyRepository = apiKeyRepository;
    this.logger = logger.child({ usecase: 'ManageApiKeysUseCase' });
  }

  /**
   * Creates a new API key. Returns the entity along with the raw key
   * (which is never stored — only its SHA-256 hash is persisted).
   */
  async createApiKey(input: CreateApiKeyInput): Promise<CreateApiKeyResult> {
    const rawKey = this.generateRawKey();
    const keyHash = this.hashKey(rawKey);

    const apiKey = ApiKey.create({
      tenantId: input.tenantId,
      keyHash,
      name: input.name,
      permissions: input.permissions,
      rateLimit: input.rateLimit,
      expiresAt: input.expiresAt,
      createdBy: input.createdBy,
    });

    await this.apiKeyRepository.save(apiKey);

    this.logger.info('API key created', {
      apiKeyId: apiKey.id,
      tenantId: apiKey.tenantId,
      name: apiKey.name,
    });

    return { apiKey, rawKey };
  }

  /**
   * Revokes (deactivates) an existing API key by ID.
   */
  async revokeApiKey(id: string): Promise<void> {
    const existing = await this.apiKeyRepository.findById(id);
    if (!existing) {
      this.logger.warn('Attempted to revoke non-existent API key', { apiKeyId: id });
      return;
    }

    const revoked = existing.revoke();
    await this.apiKeyRepository.save(revoked);

    this.logger.info('API key revoked', { apiKeyId: id, tenantId: existing.tenantId });
  }

  /**
   * Rotates an API key: generates a new raw key, hashes it,
   * and updates the stored entity. Returns the new raw key.
   */
  async rotateApiKey(id: string): Promise<CreateApiKeyResult> {
    const existing = await this.apiKeyRepository.findById(id);
    if (!existing) {
      throw new Error(`API key with id '${id}' not found`);
    }

    const newRawKey = this.generateRawKey();
    const newKeyHash = this.hashKey(newRawKey);
    const rotated = existing.rotate(newKeyHash);

    await this.apiKeyRepository.save(rotated);

    this.logger.info('API key rotated', { apiKeyId: id, tenantId: existing.tenantId });

    return { apiKey: rotated, rawKey: newRawKey };
  }

  /**
   * Lists all API keys for a given tenant.
   */
  async listApiKeys(tenantId: string): Promise<ApiKey[]> {
    return this.apiKeyRepository.findByTenantId(tenantId);
  }

  /**
   * Generates a cryptographically secure random API key string.
   * Format: dms_{48 random hex characters} (prefix aids identification).
   */
  private generateRawKey(): string {
    const bytes = randomBytes(24);
    return `dms_${bytes.toString('hex')}`;
  }

  /**
   * Hashes a raw API key using SHA-256.
   */
  private hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }
}
