import { TenantAggregate, TenantStatus } from '../entities/tenant.entity.js';

export interface ListTenantsOptions {
  page?: number;
  limit?: number;
  status?: TenantStatus;
  searchName?: string;
  sortBy?: 'createdAt' | 'name' | 'status';
  sortOrder?: 'ASC' | 'DESC';
}

export interface TenantRepository {
  save(tenant: any, tenantId?: string): Promise<any>;
  findById(id: string, tenantId?: string): Promise<any>;
  findByName?(name: string, tenantId?: string): Promise<any>;
  findByCode?(code: string, tenantId?: string): Promise<any>;
  findBySubdomain?(subdomain: string): Promise<any>;
  findByCustomDomain?(domain: string): Promise<any>;
  list(tenantId?: string, options?: ListTenantsOptions): Promise<{ items: any[]; total: number }>;
  findAll?(tenantId?: string, options?: any): Promise<any>;
  update(tenant: any, tenantId?: string): Promise<any>;
  delete(id: string, tenantId?: string): Promise<boolean>;
}
