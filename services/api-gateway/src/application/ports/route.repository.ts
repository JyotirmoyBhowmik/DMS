import { Route, HttpMethod } from '../../domain/entities/index.js';

/**
 * Port interface for Route persistence operations.
 */
export interface IRouteRepository {
  findById(id: string): Promise<Route | null>;
  findByPathAndMethod(path: string, method: HttpMethod): Promise<Route | null>;
  findAll(): Promise<Route[]>;
  findByService(serviceName: string): Promise<Route[]>;
  save(route: Route): Promise<void>;
  delete(id: string): Promise<void>;
}
