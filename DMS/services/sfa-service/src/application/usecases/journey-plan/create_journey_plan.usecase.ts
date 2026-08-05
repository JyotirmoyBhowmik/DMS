import { randomUUID } from 'node:crypto';
import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { CreateJourneyPlanInput } from '@dms/pkg-validation';
import { JourneyPlan } from '../../../domain/entities/journey-plan.js';
import { makeEnvelope } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { JourneyPlanRepository } from '../../../infrastructure/database/repositories/journey_plan.repository.js';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { OutboxRepository } from '@dms/pkg-events';

export class CreateJourneyPlanUseCase {
  private logger = new StructuredLogger('CreateJourneyPlanUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: JourneyPlanRepository,
  ) {}

  async execute(tenantId: string, agentId: string, input: CreateJourneyPlanInput): Promise<{ planId: string; status: string }> {
    this.logger.info('Executing CreateJourneyPlanUseCase', { beatId: input.beatId, agentId });

    const activeRepo = this.repo || new JourneyPlanRepository(this.db);

    // Business precondition check: agent cannot have more than 1 beat plan per day
    const existing = await activeRepo.findByAgentAndDate(agentId, input.date, tenantId);
    if (existing) {
      throw new Error(`Journey plan already exists for agent ${agentId} on date ${input.date}`);
    }

    const planId = input.id ?? randomUUID();
    const plannedOutlets = input.plannedOutlets.map((o) => ({
      outletId: o.outletId,
      outletName: o.outletName,
      sequence: o.sequence,
      latitude: o.latitude,
      longitude: o.longitude,
      estimatedArrival: new Date(o.estimatedArrival),
      visited: o.visited ?? false,
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

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'journey_plan.created',
      'v1',
      {
        planId,
        agentId,
        date: plan.date,
        beatId: plan.beatId,
        totalPlanned: plan.plannedOutlets.length,
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

          // 1. Save plan
          await txRepo.save(plan);

          // 2. Save event in outbox
          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'JourneyPlan', planId);
        }, tenantId);
        this.logger.info('Persisted journey plan and created outbox event transactionally');
      } catch (err: any) {
        this.logger.warn('Failed database transaction, falling back to memory save', { error: err.message });
        await activeRepo.save(plan);
      }
    } else {
      await activeRepo.save(plan);
    }

    return {
      planId,
      status: plan.status,
    };
  }
}
