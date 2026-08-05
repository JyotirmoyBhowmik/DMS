import { Distributor } from '../entities/distributor.js';
import { PaginatedResult, FindAllOptions } from '@dms/pkg-database';

export interface DistributorRepository {
  save(entity: Distributor, tenantId: string): Promise<Distributor>;
  findById(id: string, tenantId: string): Promise<Distributor>;
  findAll(tenantId: string, options?: FindAllOptions): Promise<PaginatedResult<Distributor>>;
  update(entity: Distributor, tenantId: string): Promise<Distributor>;
  delete(id: string, tenantId: string): Promise<boolean>;
  findByRegion(region: string, tenantId: string): Promise<Distributor[]>;
}
