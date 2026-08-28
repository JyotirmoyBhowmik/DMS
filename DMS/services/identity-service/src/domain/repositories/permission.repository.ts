import { PermissionAggregate, PermissionStatus } from '../entities/permission.entity.js';

export interface ListPermissionsOptions {
  page?: number;
  limit?: number;
  status?: PermissionStatus;
  resource?: string;
  searchName?: string;
  sortBy?: 'createdAt' | 'name' | 'status';
  sortOrder?: 'ASC' | 'DESC';
}

export interface PermissionRepository {
  save(permission: any, tenantId: string): Promise<any>;
  findById(id: string, tenantId: string): Promise<any>;
  findByName?(name: string, tenantId: string): Promise<any>;
  list(
    tenantId: string,
    options?: ListPermissionsOptions,
  ): Promise<{ items: any[]; total: number }>;
  findAll?(tenantId: string, options?: any): Promise<any>;
  update(permission: any, tenantId: string): Promise<any>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
