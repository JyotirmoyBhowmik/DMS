import { StructuredLogger } from '@dms/pkg-logger';
import { BeatRoute } from '../../../domain/entities/beat-route.js';
import { BeatRoutePgRepository } from '../../../infrastructure/database/repositories/beat-route.pg-repository.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class GetBeatRouteUseCase {
  private logger = new StructuredLogger('GetBeatRouteUseCase');

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: BeatRoutePgRepository,
  ) {}

  async execute(tenantId: string, id: string): Promise<BeatRoute> {
    this.logger.info('Executing GetBeatRouteUseCase', { id, tenantId });

    const activeRepo = this.repo || new BeatRoutePgRepository(this.db);
    const route = await activeRepo.findById(id, tenantId);

    if (!route) {
      this.logger.warn('Beat route not found', { id, tenantId });
      throw new Error(`Beat route with ID ${id} not found`);
    }

    return route;
  }
}
