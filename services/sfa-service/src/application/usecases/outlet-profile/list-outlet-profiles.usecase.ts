import { StructuredLogger } from '@dms/pkg-logger';
import { OutletProfile } from '../../../domain/entities/outlet-profile.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { OutletProfilePgRepository } from '../../../infrastructure/database/repositories/outlet-profile.pg-repository.js';

export class ListOutletProfilesUseCase {
  private logger = new StructuredLogger('ListOutletProfilesUseCase');

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: OutletProfilePgRepository,
  ) {}

  async execute(
    tenantId: string,
    query: {
      outletType?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<{ data: OutletProfile[]; total: number; page: number; pageSize: number }> {
    this.logger.info('Executing ListOutletProfilesUseCase', { tenantId, query });

    const activeRepo = this.repo || new OutletProfilePgRepository(this.db);
    let profiles = await activeRepo.findAll(tenantId);

    // Apply filtering
    if (query.outletType) {
      profiles = profiles.filter(p => p.outletType === query.outletType);
    }
    if (query.status) {
      profiles = profiles.filter(p => p.status === query.status);
    }

    const total = profiles.length;
    const page = query.page || 1;
    const pageSize = Math.min(query.pageSize || 100, 100); // hard capped pagination limit
    const startIdx = (page - 1) * pageSize;
    const paginatedData = profiles.slice(startIdx, startIdx + pageSize);

    return {
      data: paginatedData,
      total,
      page,
      pageSize,
    };
  }
}
