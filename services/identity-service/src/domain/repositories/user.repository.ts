import { UserAggregate, UserStatus } from '../entities/user.entity.js';

export interface ListUsersOptions {
  page?: number;
  limit?: number;
  status?: UserStatus;
  role?: string;
  searchEmail?: string;
  sortBy?: 'createdAt' | 'email' | 'status';
  sortOrder?: 'ASC' | 'DESC';
}

export interface UserRepository {
  save(user: any, tenantId: string): Promise<any>;
  findById(id: string, tenantId: string): Promise<any>;
  findByEmail?(email: string, tenantId: string): Promise<any>;
  list(tenantId: string, options?: ListUsersOptions): Promise<{ items: any[]; total: number }>;
  findAll?(tenantId: string, options?: any): Promise<any>;
  update(user: any, tenantId: string): Promise<any>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
