import { StructuredLogger } from '@dms/pkg-logger';
import { JourneyPlan } from '../../../domain/entities/journey-plan.js';
import { JourneyPlanRepository } from '../../../infrastructure/database/repositories/journey_plan.repository.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';

export class GetJourneyPlanUseCase {
  private logger = new StructuredLogger('GetJourneyPlanUseCase');

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: JourneyPlanRepository,
  ) {}

  async execute(tenantId: string, planId: string): Promise<JourneyPlan> {
    this.logger.info('Executing GetJourneyPlanUseCase', { planId, tenantId });

    const activeRepo = this.repo || new JourneyPlanRepository(this.db);
    const plan = await activeRepo.findById(planId, tenantId);

    if (!plan) {
      this.logger.warn('Journey plan not found', { planId, tenantId });
      throw new Error(`Journey plan with ID ${planId} not found`);
    }

    return plan;
  }
}
