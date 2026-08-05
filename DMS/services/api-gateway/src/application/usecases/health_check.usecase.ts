import { Logger } from '@dms/pkg-logger';
import type { IUpstreamAdapter } from '../ports/upstream.adapter.js';
import type { IRouteRepository } from '../ports/route.repository.js';

/**
 * Health status of a single upstream service.
 */
export interface ServiceHealth {
  readonly name: string;
  readonly status: 'up' | 'down';
  readonly latencyMs: number;
  readonly error?: string;
}

/**
 * Aggregated health check result for the gateway.
 */
export interface HealthCheckResult {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly services: ServiceHealth[];
  readonly timestamp: Date;
}

/**
 * HealthCheckUseCase pings all upstream services and returns
 * an aggregated health status.
 */
export class HealthCheckUseCase {
  private readonly upstreamAdapter: IUpstreamAdapter;
  private readonly routeRepository: IRouteRepository;
  private readonly logger: Logger;

  constructor(
    upstreamAdapter: IUpstreamAdapter,
    routeRepository: IRouteRepository,
    logger: Logger,
  ) {
    this.upstreamAdapter = upstreamAdapter;
    this.routeRepository = routeRepository;
    this.logger = logger.child({ usecase: 'HealthCheckUseCase' });
  }

  /**
   * Executes health checks against all unique upstream services.
   */
  async execute(): Promise<HealthCheckResult> {
    this.logger.info('Starting health check');

    // Discover all unique target services from registered routes
    const routes = await this.routeRepository.findAll();
    const uniqueServices = new Set<string>();
    for (const route of routes) {
      uniqueServices.add(route.targetService);
    }

    // Ping each service concurrently
    const healthPromises = Array.from(uniqueServices).map((serviceName) =>
      this.checkService(serviceName),
    );

    const services = await Promise.all(healthPromises);

    // Determine aggregate status
    const downCount = services.filter((s) => s.status === 'down').length;
    let status: HealthCheckResult['status'];
    if (downCount === 0) {
      status = 'healthy';
    } else if (downCount < services.length) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    const result: HealthCheckResult = {
      status,
      services,
      timestamp: new Date(),
    };

    this.logger.info('Health check completed', {
      status: result.status,
      totalServices: services.length,
      downCount,
    });

    return result;
  }

  /**
   * Checks the health of a single upstream service by sending
   * a GET request to its /health endpoint.
   */
  private async checkService(serviceName: string): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const response = await this.upstreamAdapter.forward({
        method: 'GET',
        url: `${serviceName}/health`,
        headers: { 'accept': 'application/json' },
        timeout: 5_000,
      });

      const latencyMs = Date.now() - startTime;
      const isUp = response.status >= 200 && response.status < 300;

      return {
        name: serviceName,
        status: isUp ? 'up' : 'down',
        latencyMs,
        ...(isUp ? {} : { error: `Responded with status ${response.status}` }),
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn('Health check failed for service', {
        service: serviceName,
        error: errorMessage,
        latencyMs,
      });

      return {
        name: serviceName,
        status: 'down',
        latencyMs,
        error: errorMessage,
      };
    }
  }
}
