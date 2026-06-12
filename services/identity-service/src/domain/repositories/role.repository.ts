import { Role } from '../entities/role.js';
import { PaginatedResult, FindAllOptions } from '@dms/pkg-database';

export interface RoleRepository {
  save(entity: Role, tenantId: string): Promise<Role>;
  findById(id: string, tenantId: string): Promise<Role>;
  findAll(tenantId: string, options?: FindAllOptions): Promise<PaginatedResult<Role>>;
  update(entity: Role, tenantId: string): Promise<Role>;
  delete(id: string, tenantId: string): Promise<boolean>;
  findByName(name: string, tenantId: string): Promise<Role | null>;
}
