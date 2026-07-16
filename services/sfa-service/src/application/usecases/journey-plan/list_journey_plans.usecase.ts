import { StructuredLogger } from '@dms/pkg-logger';
import { JourneyPlan } from '../../../domain/entities/journey-plan.js';
import { JourneyPlanRepository } from '../../../infrastructure/database/repositories/journey_plan.repository.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export interface ListJourneyPlansQuery {
  page?: number;
  pageSize?: number;
  agentId?: string;
  date?: string;
  status?: string;
}

export class ListJourneyPlansUseCase {
  private logger = new StructuredLogger('ListJourneyPlansUseCase');

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: JourneyPlanRepository,
  ) {}

  async execute(tenantId: string, query: ListJourneyPlansQuery): Promise<{ data: JourneyPlan[]; page: number; pageSize: number }> {
    this.logger.info('Executing ListJourneyPlansUseCase', { query, tenantId });

    const activeRepo = this.repo || new JourneyPlanRepository(this.db);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20)); // hard maximum cap 100

    let plans = await activeRepo.findAll(tenantId);
    if (plans.length === 0) {
      // Fallback to memory repo
      plans = Array.from(JourneyPlanRepository.inMemoryDb.values()) as JourneyPlan[];
    }

    // Tenant isolation
    plans = plans.filter(p => p.tenantId === tenantId);

    // Apply filters
    if (query.agentId) {
      plans = plans.filter(p => p.agentId === query.agentId);
    }
    if (query.date) {
      plans = plans.filter(p => p.date === query.date);
    }
    if (query.status) {
      const statusLower = query.status.toLowerCase();
      plans = plans.filter(p => p.status === statusLower);
    }

    // Keyset pagination slicing
    const startIndex = (page - 1) * pageSize;
    const paginated = plans.slice(startIndex, startIndex + pageSize);

    return {
      data: paginated,
      page,
      pageSize,
    };
  }
}
