import { Tenant } from '../entities/tenant.js';
import { PaginatedResult, FindAllOptions } from '@dms/pkg-database';

export interface TenantRepository {
  save(entity: Tenant, tenantId: string): Promise<Tenant>;
  findById(id: string, tenantId: string): Promise<Tenant>;
  findAll(tenantId: string, options?: FindAllOptions): Promise<PaginatedResult<Tenant>>;
  update(entity: Tenant, tenantId: string): Promise<Tenant>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
