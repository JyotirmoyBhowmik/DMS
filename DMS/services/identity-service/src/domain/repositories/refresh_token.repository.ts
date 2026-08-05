import { RefreshToken } from '../entities/refresh_token.js';
import { PaginatedResult, FindAllOptions } from '@dms/pkg-database';

export interface RefreshTokenRepository {
  save(entity: RefreshToken, tenantId: string): Promise<RefreshToken>;
  findById(id: string, tenantId: string): Promise<RefreshToken>;
  findAll(tenantId: string, options?: FindAllOptions): Promise<PaginatedResult<RefreshToken>>;
  update(entity: RefreshToken, tenantId: string): Promise<RefreshToken>;
  delete(id: string, tenantId: string): Promise<boolean>;
  findByToken(token: string, tenantId: string): Promise<RefreshToken | null>;
  findByFamilyId(familyId: string, tenantId: string): Promise<RefreshToken[]>;
}
