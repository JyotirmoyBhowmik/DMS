import { Permission } from '../entities/permission.js';
import { PaginatedResult, FindAllOptions } from '@dms/pkg-database';

export interface PermissionRepository {
  save(entity: Permission, tenantId: string): Promise<Permission>;
  findById(id: string, tenantId: string): Promise<Permission>;
  findAll(tenantId: string, options?: FindAllOptions): Promise<PaginatedResult<Permission>>;
  update(entity: Permission, tenantId: string): Promise<Permission>;
  delete(id: string, tenantId: string): Promise<boolean>;
  findByName(name: string, tenantId: string): Promise<Permission | null>;
}
