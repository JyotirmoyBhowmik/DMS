import { InboundEvent, IdempotentConsumer } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { MessageBrokerClient } from '@dms/pkg-events';
import { StructuredLogger } from '@dms/pkg-logger';
import { KPIAchievementPgRepository } from '../../../infrastructure/database/repositories/kpi-achievement.pg-repository.js';

export class VisitCompletedKPIConsumer {
  private logger = new StructuredLogger('VisitCompletedKPIConsumer');
  private consumer: IdempotentConsumer;

  constructor(
    private readonly db: PostgresDatabaseClient,
    private readonly broker: MessageBrokerClient,
  ) {
    this.consumer = new IdempotentConsumer(
      this.db,
      this.broker,
      this.handleEvent.bind(this),
      {
        consumerGroup: 'sfa-kpi-achievement-service',
        tableName: 'processed_events',
      }
    );
  }

  start(): void {
    this.logger.info('Starting VisitCompletedKPIConsumer subscription');
    this.consumer.subscribe('visit.completed.v1');
  }

  private async handleEvent(event: InboundEvent<any>): Promise<void> {
    const { agentId, timestamp } = event.payload || {};
    const tenantId = event.tenantId;

    if (!agentId || !tenantId) {
      this.logger.warn('VisitCompletedKPIConsumer skipped: missing agentId or tenantId', { eventId: event.eventId });
      return;
    }

    this.logger.info('VisitCompletedKPIConsumer processing visit.completed', {
      eventId: event.eventId,
      agentId,
      tenantId,
    });

    const date = timestamp ? new Date(timestamp) : new Date();
    const periodMonth = date.getMonth() + 1;
    const periodYear = date.getFullYear();

    try {
      await this.db.transaction(async (conn) => {
        const txRepo = new KPIAchievementPgRepository(conn);
        const achievements = await txRepo.findByAgentAndPeriod(agentId, periodMonth, periodYear, tenantId);
        
        // Find KPI target of type 'visits' that is active (DRAFT, SUBMITTED or APPROVED)
        const activeKPI = achievements.find((t) => t.kpiType === 'visits' && t.status !== 'REJECTED');
        if (!activeKPI) {
          this.logger.info('No active visits KPI target found for agent in this period', { agentId, periodYear, periodMonth });
          return;
        }

        // Increment the visits progress
        const newVal = activeKPI.achievedValue + 1;
        activeKPI.updateProgress(newVal);

        await txRepo.save(activeKPI, tenantId);

        this.logger.info('KPIAchievement visits progress updated successfully', {
          id: activeKPI.id,
          newAchievedValue: activeKPI.achievedValue,
          newProgress: activeKPI.progressPercentage,
        });
      }, tenantId);
    } catch (err: any) {
      this.logger.error('Failed to update visits KPI achievement on visit.completed event', {
        eventId: event.eventId,
        error: err.message,
      });
      throw err;
    }
  }
}
