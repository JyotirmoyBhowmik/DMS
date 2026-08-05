import { StructuredLogger } from '@dms/pkg-logger';
import { OutletCensus } from '../../../domain/entities/outlet-census.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { OutletCensusPgRepository } from '../../../infrastructure/database/repositories/outlet-census.pg-repository.js';

export class GetOutletCensusUseCase {
  private logger = new StructuredLogger('GetOutletCensusUseCase');

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: OutletCensusPgRepository,
  ) {}

  async execute(tenantId: string, id: string): Promise<OutletCensus> {
    this.logger.info('Executing GetOutletCensusUseCase', { id, tenantId });

    const activeRepo = this.repo || new OutletCensusPgRepository(this.db);
    const census = await activeRepo.findById(id, tenantId);

    if (!census) {
      this.logger.warn('OutletCensus record not found or unauthorized', { id, tenantId });
      throw new Error(`OutletCensus record with ID ${id} not found or unauthorized`);
    }

    return census;
  }
}
