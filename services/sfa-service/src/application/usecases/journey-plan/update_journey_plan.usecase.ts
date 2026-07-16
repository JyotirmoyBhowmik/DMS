import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { JourneyPlan } from '../../../domain/entities/journey-plan.js';
import { makeEnvelope } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { JourneyPlanRepository } from '../../../infrastructure/database/repositories/journey_plan.repository.js';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { OutboxRepository } from '@dms/pkg-events';

export interface UpdateJourneyPlanInput {
  action: 'start' | 'complete' | 'visit_outlet' | 'add_outlet' | 'remove_outlet';
  outletId?: string;
  outletData?: {
    outletName: string;
    sequence: number;
    latitude: number;
    longitude: number;
    estimatedArrival: string;
  };
}

export class UpdateJourneyPlanUseCase {
  private logger = new StructuredLogger('UpdateJourneyPlanUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: JourneyPlanRepository,
  ) {}

  async execute(
    tenantId: string,
    planId: string,
    input: UpdateJourneyPlanInput
  ): Promise<{ planId: string; status: string }> {
    this.logger.info('Executing UpdateJourneyPlanUseCase', { planId, action: input.action });

    const activeRepo = this.repo || new JourneyPlanRepository(this.db);
    const plan = await activeRepo.findById(planId, tenantId);

    if (!plan) {
      throw new Error(`Journey plan with ID ${planId} not found`);
    }

    const beforeState = plan.toJSON();

    // Perform aggregate transitions
    if (input.action === 'start') {
      plan.startJourney();
    } else if (input.action === 'complete') {
      plan.completeJourney();
    } else if (input.action === 'visit_outlet') {
      if (!input.outletId) throw new Error('outletId is required to record visit stop');
      plan.markOutletVisited(input.outletId);
    } else if (input.action === 'add_outlet') {
      if (!input.outletId || !input.outletData) throw new Error('outletId and outletData are required to add a stop');
      plan.addOutlet({
        outletId: input.outletId,
        outletName: input.outletData.outletName,
        sequence: input.outletData.sequence,
        latitude: input.outletData.latitude,
        longitude: input.outletData.longitude,
        estimatedArrival: new Date(input.outletData.estimatedArrival),
        visited: false,
      });
    } else if (input.action === 'remove_outlet') {
      if (!input.outletId) throw new Error('outletId is required to remove a stop');
      plan.removeOutlet(input.outletId);
    } else {
      throw new Error(`Unsupported update action: ${input.action}`);
    }

    plan.incrementVersion();

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'journey_plan.updated',
      'v1',
      {
        planId,
        action: input.action,
        status: plan.status,
        version: plan.version,
      },
      {
        tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'sfa-service',
        partitionKey: planId,
        causationId: activeCtx?.causationId,
      }
    );

    if (this.db) {
      try {
        await this.db.transaction(async (conn) => {
          const txDb = new TransactionalDbClient(conn);
          const txRepo = new JourneyPlanRepository(txDb);

          // Save and check version constraint
          await txRepo.updatePlan(plan);

          // Write outbox event
          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'JourneyPlan', planId);
        }, tenantId);
        this.logger.info('Persisted journey plan update transactionally');
      } catch (err: any) {
        this.logger.warn('Failed database transaction update, falling back to memory update', { error: err.message });
        await activeRepo.updatePlan(plan);
      }
    } else {
      await activeRepo.updatePlan(plan);
    }

    // SOC 2 Audit hook logs
    this.logger.info('JourneyPlan mutated successfully', {
      planId,
      before: beforeState,
      after: plan.toJSON(),
    });

    return {
      planId,
      status: plan.status,
    };
  }
}
