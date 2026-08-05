import { ApiKey } from '../../domain/entities/index.js';

/**
 * Port interface for ApiKey persistence operations.
 */
export interface IApiKeyRepository {
  findById(id: string): Promise<ApiKey | null>;
  findByKeyHash(keyHash: string): Promise<ApiKey | null>;
  findByTenantId(tenantId: string): Promise<ApiKey[]>;
  save(apiKey: ApiKey): Promise<void>;
  delete(id: string): Promise<void>;
}
