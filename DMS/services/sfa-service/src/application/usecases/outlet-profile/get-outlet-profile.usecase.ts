import { StructuredLogger } from '@dms/pkg-logger';
import { OutletProfile } from '../../../domain/entities/outlet-profile.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { OutletProfilePgRepository } from '../../../infrastructure/database/repositories/outlet-profile.pg-repository.js';

export class GetOutletProfileUseCase {
  private logger = new StructuredLogger('GetOutletProfileUseCase');

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: OutletProfilePgRepository,
  ) {}

  async execute(id: string, tenantId: string): Promise<OutletProfile> {
    this.logger.info('Executing GetOutletProfileUseCase', { id, tenantId });

    const activeRepo = this.repo || new OutletProfilePgRepository(this.db);
    const profile = await activeRepo.findById(id, tenantId);

    if (!profile) {
      this.logger.warn('OutletProfile not found', { id, tenantId });
      throw new Error(`OutletProfile record with ID ${id} not found or unauthorized`);
    }

    return profile;
  }
}
