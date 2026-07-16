import { StructuredLogger } from '@dms/pkg-logger';
import { Visit } from '../../../domain/entities/visit.js';
import { VisitRepository } from '../../../infrastructure/database/repositories/visit.repository.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export interface ListVisitsQuery {
  page?: number;
  pageSize?: number;
  outletId?: string;
  agentId?: string;
  status?: string;
}

export class ListVisitsUseCase {
  private logger = new StructuredLogger('ListVisitsUseCase');

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: VisitRepository,
  ) {}

  async execute(tenantId: string, query: ListVisitsQuery): Promise<{ data: Visit[]; page: number; pageSize: number }> {
    this.logger.info('Executing ListVisitsUseCase', { query, tenantId });

    const activeRepo = this.repo || new VisitRepository(this.db);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20)); // hard maximum cap 100

    let visits = await activeRepo.findAll(tenantId);
    if (visits.length === 0) {
      visits = Array.from(VisitRepository.inMemoryDb.values()) as Visit[];
    }

    // Tenant isolation
    visits = visits.filter(v => v.tenantId === tenantId);

    // Apply filters
    if (query.outletId) {
      visits = visits.filter(v => v.outletId === query.outletId);
    }
    if (query.agentId) {
      visits = visits.filter(v => v.agentId === query.agentId);
    }
    if (query.status) {
      visits = visits.filter(v => v.status === query.status!.toLowerCase());
    }

    // Pagination slicing
    const startIndex = (page - 1) * pageSize;
    const paginated = visits.slice(startIndex, startIndex + pageSize);

    return {
      data: paginated,
      page,
      pageSize,
    };
  }
}
