import { StructuredLogger } from '@dms/pkg-logger';
import { BeatRoute } from '../../../domain/entities/beat-route.js';
import { BeatRoutePgRepository } from '../../../infrastructure/database/repositories/beat-route.pg-repository.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export interface ListBeatRoutesQuery {
  page?: number;
  pageSize?: number;
  region?: string;
  agentId?: string;
  status?: string;
}

export class ListBeatRoutesUseCase {
  private logger = new StructuredLogger('ListBeatRoutesUseCase');

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: BeatRoutePgRepository,
  ) {}

  async execute(tenantId: string, query: ListBeatRoutesQuery): Promise<{ data: BeatRoute[]; page: number; pageSize: number }> {
    this.logger.info('Executing ListBeatRoutesUseCase', { query, tenantId });

    const activeRepo = this.repo || new BeatRoutePgRepository(this.db);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20)); // hard maximum cap 100

    let routes = await activeRepo.findAll(tenantId);
    if (routes.length === 0) {
      routes = Array.from(BeatRoutePgRepository.inMemoryDb.values()) as BeatRoute[];
    }

    // Tenant isolation
    routes = routes.filter(r => r.tenantId === tenantId);

    // Apply filters
    if (query.region) {
      routes = routes.filter(r => r.region.toLowerCase() === query.region!.toLowerCase());
    }
    if (query.agentId) {
      routes = routes.filter(r => r.assignedAgentIds.includes(query.agentId!));
    }
    if (query.status) {
      routes = routes.filter(r => r.status === query.status!.toLowerCase());
    }

    // Pagination slicing
    const startIndex = (page - 1) * pageSize;
    const paginated = routes.slice(startIndex, startIndex + pageSize);

    return {
      data: paginated,
      page,
      pageSize,
    };
  }
}
