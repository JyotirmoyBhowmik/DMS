import { StructuredLogger } from '@dms/pkg-logger';
import { OutletCensus } from '../../../domain/entities/outlet-census.js';
import { OutletCensusPgRepository } from '../../../infrastructure/database/repositories/outlet-census.pg-repository.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export interface ListOutletCensusesQuery {
  page?: number;
  pageSize?: number;
  agentId?: string;
  outletId?: string;
  status?: string;
  kycStatus?: string;
}

export class ListOutletCensusesUseCase {
  private logger = new StructuredLogger('ListOutletCensusesUseCase');

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: OutletCensusPgRepository,
  ) {}

  async execute(tenantId: string, query: ListOutletCensusesQuery): Promise<{ data: OutletCensus[]; page: number; pageSize: number }> {
    this.logger.info('Executing ListOutletCensusesUseCase', { query, tenantId });

    const activeRepo = this.repo || new OutletCensusPgRepository(this.db);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20)); // cap at 100

    let list = await activeRepo.findAll(tenantId);

    if (list.length === 0) {
      list = Array.from(OutletCensusPgRepository.inMemoryDb.values()).filter(g => g.tenantId === tenantId);
    }

    // Apply filters
    if (query.agentId) {
      list = list.filter(g => g.agentId === query.agentId);
    }
    if (query.outletId) {
      list = list.filter(g => g.outletId === query.outletId);
    }
    if (query.status) {
      const statusVal = query.status.toLowerCase();
      list = list.filter(g => g.status === statusVal);
    }
    if (query.kycStatus) {
      const kycStatusVal = query.kycStatus.toLowerCase();
      list = list.filter(g => g.kycStatus === kycStatusVal);
    }

    // Pagination slicing
    const startIndex = (page - 1) * pageSize;
    const paginated = list.slice(startIndex, startIndex + pageSize);

    return {
      data: paginated,
      page,
      pageSize,
    };
  }
}
