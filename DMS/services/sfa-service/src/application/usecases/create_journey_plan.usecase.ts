import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { JourneyPlan } from '../../domain/entities/journey-plan.js';
import { JourneyPlanRepository } from '../../infrastructure/database/repositories/journey_plan.repository.js';
import { makeEnvelope } from '@dms/pkg-events';
import { randomUUID } from 'crypto';
import { PlannedOutlet } from '../../domain/entities/journey-plan.js';

export interface CreateJourneyPlanResult {
  planId: string;
  status: string;
  event: any;
}

export class CreateJourneyPlanUseCase {
  private logger = new StructuredLogger('CreateJourneyPlanUseCase');

  async execute(
    repo: JourneyPlanRepository,
    tenantId: string,
    agentId: string,
    input: {
      id?: string;
      date: string;
      beatId: string;
      beatName: string;
      plannedOutlets: Array<{
        outletId: string;
        outletName: string;
        sequence: number;
        latitude: number;
        longitude: number;
        estimatedArrival: string | Date;
      }>;
    }
  ): Promise<CreateJourneyPlanResult> {
    this.logger.info('Executing create journey plan use case', { tenantId, agentId, date: input.date });

    const planId = input.id ?? randomUUID();

    // Check if a plan already exists for this agent on this date
    const existing = await repo.findByAgentAndDate(agentId, input.date, tenantId);
    if (existing) {
      throw new Error(`Journey plan already exists for agent ${agentId} on ${input.date}`);
    }

    const plannedOutlets: PlannedOutlet[] = input.plannedOutlets.map((o) => ({
      outletId: o.outletId,
      outletName: o.outletName,
      sequence: o.sequence,
      latitude: o.latitude,
      longitude: o.longitude,
      estimatedArrival: typeof o.estimatedArrival === 'string' ? new Date(o.estimatedArrival) : o.estimatedArrival,
      visited: false,
    }));

    const plan = JourneyPlan.create({
      id: planId,
      tenantId,
      agentId,
      date: input.date,
      beatId: input.beatId,
      beatName: input.beatName,
      plannedOutlets,
    });

    await repo.save(plan);

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'journey_plan.created',
      'v1',
      {
        planId,
        tenantId,
        agentId,
        date: input.date,
        beatId: input.beatId,
        plannedOutlets: plan.plannedOutlets.map((o) => ({
          outletId: o.outletId,
          sequence: o.sequence,
        })),
      },
      {
        tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'sfa-service',
        partitionKey: planId,
        causationId: activeCtx?.causationId,
      }
    );

    this.logger.info('Journey plan created and registered in repository', { planId, eventId: event.eventId });

    return {
      planId,
      status: plan.status,
      event,
    };
  }
}
