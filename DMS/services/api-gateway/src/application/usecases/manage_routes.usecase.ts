import { Logger } from '@dms/pkg-logger';
import { Route, HttpMethod } from '../../domain/entities/index.js';
import type { RateLimitConfig, CircuitBreakerConfig } from '../../domain/entities/index.js';
import { RouteNotFoundError } from '../../domain/errors/index.js';
import type { IRouteRepository } from '../ports/route.repository.js';

/**
 * Input for creating a new route.
 */
export interface CreateRouteInput {
  readonly path: string;
  readonly method: HttpMethod;
  readonly targetService: string;
  readonly targetPath: string;
  readonly version?: string;
  readonly requiredPermissions?: string[];
  readonly rateLimit?: Partial<RateLimitConfig>;
  readonly timeout?: number;
  readonly retries?: number;
  readonly circuitBreaker?: Partial<CircuitBreakerConfig>;
}

/**
 * Input for updating an existing route.
 */
export interface UpdateRouteInput {
  readonly path?: string;
  readonly method?: HttpMethod;
  readonly targetService?: string;
  readonly targetPath?: string;
  readonly version?: string;
  readonly requiredPermissions?: string[];
  readonly rateLimit?: Partial<RateLimitConfig>;
  readonly timeout?: number;
  readonly retries?: number;
  readonly circuitBreaker?: Partial<CircuitBreakerConfig>;
}

/**
 * ManageRoutesUseCase handles CRUD operations for route definitions.
 */
export class ManageRoutesUseCase {
  private readonly routeRepository: IRouteRepository;
  private readonly logger: Logger;

  constructor(routeRepository: IRouteRepository, logger: Logger) {
    this.routeRepository = routeRepository;
    this.logger = logger.child({ usecase: 'ManageRoutesUseCase' });
  }

  /**
   * Creates a new route and persists it.
   */
  async createRoute(input: CreateRouteInput): Promise<Route> {
    const route = Route.create({
      path: input.path,
      method: input.method,
      targetService: input.targetService,
      targetPath: input.targetPath,
      version: input.version,
      requiredPermissions: input.requiredPermissions,
      rateLimit: input.rateLimit,
      timeout: input.timeout,
      retries: input.retries,
      circuitBreaker: input.circuitBreaker,
    });

    await this.routeRepository.save(route);

    this.logger.info('Route created', {
      routeId: route.id,
      path: route.path,
      method: route.method,
      targetService: route.targetService,
    });

    return route;
  }

  /**
   * Updates an existing route by ID.
   * @throws RouteNotFoundError if the route does not exist
   */
  async updateRoute(id: string, input: UpdateRouteInput): Promise<Route> {
    const existing = await this.routeRepository.findById(id);
    if (!existing) {
      throw new RouteNotFoundError(id, 'UPDATE');
    }

    const updated = existing.update({
      path: input.path,
      method: input.method,
      targetService: input.targetService,
      targetPath: input.targetPath,
      version: input.version,
      requiredPermissions: input.requiredPermissions,
      rateLimit: input.rateLimit,
      timeout: input.timeout,
      retries: input.retries,
      circuitBreaker: input.circuitBreaker,
    });

    await this.routeRepository.save(updated);

    this.logger.info('Route updated', {
      routeId: updated.id,
      path: updated.path,
      method: updated.method,
    });

    return updated;
  }

  /**
   * Deletes a route by ID.
   * @throws RouteNotFoundError if the route does not exist
   */
  async deleteRoute(id: string): Promise<void> {
    const existing = await this.routeRepository.findById(id);
    if (!existing) {
      throw new RouteNotFoundError(id, 'DELETE');
    }

    await this.routeRepository.delete(id);

    this.logger.info('Route deleted', { routeId: id });
  }

  /**
   * Lists all registered routes.
   */
  async listRoutes(): Promise<Route[]> {
    return this.routeRepository.findAll();
  }

  /**
   * Retrieves a single route by ID.
   * @throws RouteNotFoundError if the route does not exist
   */
  async getRoute(id: string): Promise<Route> {
    const route = await this.routeRepository.findById(id);
    if (!route) {
      throw new RouteNotFoundError(id, 'GET');
    }
    return route;
  }
}
