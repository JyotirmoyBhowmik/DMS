import { JourneyPlan } from '../../../domain/entities/journey-plan.js';
import { StructuredLogger } from '@dms/pkg-logger';

export class JourneyPlanRepository {
  private logger = new StructuredLogger('JourneyPlanRepository');
  private dbStore: Map<string, JourneyPlan> = new Map();

  async save(plan: JourneyPlan): Promise<JourneyPlan> {
    this.logger.info('Saving journey plan record to repository store', { planId: plan.id, tenantId: plan.tenantId, agentId: plan.agentId });
    this.dbStore.set(plan.id, plan);
    return plan;
  }

  async findById(planId: string, tenantId: string): Promise<JourneyPlan | null> {
    this.logger.info('Querying journey plan by identifier', { planId, tenantId });
    const match = this.dbStore.get(planId);
    if (match && match.tenantId === tenantId) {
      return match;
    }
    return null;
  }

  async findByAgentAndDate(agentId: string, date: string, tenantId: string): Promise<JourneyPlan | null> {
    this.logger.info('Querying journey plan by agent and date', { agentId, date, tenantId });
    for (const plan of this.dbStore.values()) {
      if (plan.agentId === agentId && plan.date === date && plan.tenantId === tenantId) {
        return plan;
      }
    }
    return null;
  }
}
