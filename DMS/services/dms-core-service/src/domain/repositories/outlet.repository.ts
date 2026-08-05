import { Outlet } from '../entities/outlet.js';
import { PaginatedResult, FindAllOptions } from '@dms/pkg-database';

export interface OutletRepository {
  save(entity: Outlet, tenantId: string): Promise<Outlet>;
  findById(id: string, tenantId: string): Promise<Outlet>;
  findAll(tenantId: string, options?: FindAllOptions): Promise<PaginatedResult<Outlet>>;
  update(entity: Outlet, tenantId: string): Promise<Outlet>;
  delete(id: string, tenantId: string): Promise<boolean>;
  findNearby(lat: number, lng: number, radiusMeters: number, tenantId: string): Promise<Outlet[]>;
}
