import { StructuredLogger } from '@dms/pkg-logger';
import { Visit } from '../../../domain/entities/visit.js';
import { VisitRepository } from '../../../infrastructure/database/repositories/visit.repository.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class GetVisitUseCase {
  private logger = new StructuredLogger('GetVisitUseCase');

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: VisitRepository,
  ) {}

  async execute(tenantId: string, id: string): Promise<Visit> {
    this.logger.info('Executing GetVisitUseCase', { id, tenantId });

    const activeRepo = this.repo || new VisitRepository(this.db);
    const visit = await activeRepo.findById(id, tenantId);

    if (!visit) {
      this.logger.warn('Visit not found', { id, tenantId });
      throw new Error(`Visit with ID ${id} not found`);
    }

    return visit;
  }
}
