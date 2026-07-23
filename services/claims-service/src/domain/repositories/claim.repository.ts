import { ClaimEntity } from '../entities/claim.entity.js';
import { Claim } from '../entities/claim.js';
import { PaginatedResult, FindAllOptions } from '@dms/pkg-database';

export interface IClaimRepository {
  save(claim: any, tenantId: string): Promise<any>;
  findById(id: string, tenantId: string): Promise<any>;
  update(claim: any, tenantId: string): Promise<any>;
  findAll(tenantId: string, options?: FindAllOptions): Promise<any>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
