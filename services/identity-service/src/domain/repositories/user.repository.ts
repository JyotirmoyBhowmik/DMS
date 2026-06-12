import { User } from '../entities/user.js';
import { PaginatedResult, FindAllOptions } from '@dms/pkg-database';

export interface UserRepository {
  save(entity: User, tenantId: string): Promise<User>;
  findById(id: string, tenantId: string): Promise<User>;
  findAll(tenantId: string, options?: FindAllOptions): Promise<PaginatedResult<User>>;
  update(entity: User, tenantId: string): Promise<User>;
  delete(id: string, tenantId: string): Promise<boolean>;
  findByEmail(email: string, tenantId: string): Promise<User | null>;
}
