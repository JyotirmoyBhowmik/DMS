import { ClaimEntity } from '../entities/claim.entity.js';
import { PaginatedResult, FindAllOptions } from '@dms/pkg-database';

export interface IClaimRepository {
  save(claim: ClaimEntity, tenantId: string): Promise<ClaimEntity>;
  findById(id: string, tenantId: string): Promise<ClaimEntity>;
  update(claim: ClaimEntity, tenantId: string): Promise<ClaimEntity>;
  findAll(tenantId: string, options?: FindAllOptions): Promise<PaginatedResult<ClaimEntity>>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
