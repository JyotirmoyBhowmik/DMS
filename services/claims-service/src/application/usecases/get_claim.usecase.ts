import { StructuredLogger } from '@dms/pkg-logger';
import { ClaimEntity } from '../../domain/entities/claim.entity.js';
import { IClaimRepository } from '../../domain/repositories/claim.repository.js';
import { ClaimPgRepository } from '../../infrastructure/database/repositories/claim.pg-repository.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class GetClaimUseCase {
  private logger = new StructuredLogger('GetClaimUseCase');

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly claimRepo?: IClaimRepository
  ) {}

  async execute(tenantId: string, claimId: string): Promise<ClaimEntity> {
    this.logger.info('Retrieving claim by ID', { claimId });

    if (this.db) {
      const repo = this.claimRepo || new ClaimPgRepository(this.db);
      return await repo.findById(claimId, tenantId);
    }

    throw new Error('Database client not configured');
  }
}
