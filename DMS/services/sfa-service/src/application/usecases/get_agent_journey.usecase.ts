import { StructuredLogger } from '@dms/pkg-logger';
import { JourneyPlan } from '../../domain/entities/journey-plan.js';
import { JourneyPlanRepository } from '../../infrastructure/database/repositories/journey_plan.repository.js';

export class GetAgentJourneyUseCase {
  private logger = new StructuredLogger('GetAgentJourneyUseCase');

  async execute(
    repo: JourneyPlanRepository,
    tenantId: string,
    agentId: string,
    date: string
  ): Promise<JourneyPlan | null> {
    this.logger.info('Executing get agent journey use case', { tenantId, agentId, date });
    return repo.findByAgentAndDate(agentId, date, tenantId);
  }
}
