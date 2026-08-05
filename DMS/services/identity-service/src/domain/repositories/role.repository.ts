import { RoleAggregate, RoleStatus } from '../entities/role.entity.js';

export interface ListRolesOptions {
  page?: number;
  limit?: number;
  status?: RoleStatus;
  searchName?: string;
  sortBy?: 'createdAt' | 'name' | 'status';
  sortOrder?: 'ASC' | 'DESC';
}

export interface RoleRepository {
  save(role: any, tenantId: string): Promise<any>;
  findById(id: string, tenantId: string): Promise<any>;
  findByName?(name: string, tenantId: string): Promise<any>;
  list(tenantId: string, options?: ListRolesOptions): Promise<{ items: any[]; total: number }>;
  findAll?(tenantId: string, options?: any): Promise<any>;
  update(role: any, tenantId: string): Promise<any>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
