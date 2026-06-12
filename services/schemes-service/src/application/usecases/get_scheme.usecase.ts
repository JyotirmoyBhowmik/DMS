import { StructuredLogger } from '@dms/pkg-logger';
import { SchemeEntity } from '../../domain/entities/scheme.entity.js';
import { ISchemeRepository } from '../../domain/repositories/scheme.repository.js';
import { SchemePgRepository } from '../../infrastructure/database/repositories/scheme.pg-repository.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class GetSchemeUseCase {
  private logger = new StructuredLogger('GetSchemeUseCase');

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly schemeRepo?: ISchemeRepository
  ) {}

  async execute(tenantId: string, schemeId: string): Promise<SchemeEntity> {
    this.logger.info('Retrieving scheme details', { schemeId });

    if (this.db) {
      const repo = this.schemeRepo || new SchemePgRepository(this.db);
      return await repo.findById(schemeId, tenantId);
    }

    throw new Error('Database client not configured');
  }
}
