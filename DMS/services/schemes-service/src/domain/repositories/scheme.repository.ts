import { SchemeEntity } from '../entities/scheme.entity.js';
import { PaginatedResult, FindAllOptions } from '@dms/pkg-database';

export interface ISchemeRepository {
  save(scheme: SchemeEntity, tenantId: string): Promise<SchemeEntity>;
  findById(id: string, tenantId: string): Promise<SchemeEntity>;
  update(scheme: SchemeEntity, tenantId: string): Promise<SchemeEntity>;
  findAll(tenantId: string, options?: FindAllOptions): Promise<PaginatedResult<SchemeEntity>>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
