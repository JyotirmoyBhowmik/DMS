import { randomUUID } from 'node:crypto';
import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { CreateVisitInput } from '@dms/pkg-validation';
import { Visit } from '../../../domain/entities/visit.js';
import { makeEnvelope } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { VisitRepository } from '../../../infrastructure/database/repositories/visit.repository.js';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { OutboxRepository } from '@dms/pkg-events';

export class CreateVisitUseCase {
  private logger = new StructuredLogger('CreateVisitUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: VisitRepository,
  ) {}

  async execute(tenantId: string, agentId: string, input: CreateVisitInput): Promise<{ visitId: string; status: string }> {
    this.logger.info('Executing CreateVisitUseCase', { outletId: input.outletId, agentId });

    const activeRepo = this.repo || new VisitRepository(this.db);

    // Business precondition check: check if a visit to the same outlet by the same agent exists today
    const dateStr = new Date(input.plannedDate).toISOString().split('T')[0]!;
    const existingVisits = await activeRepo.findByAgent(agentId, tenantId);
    const hasDuplicate = existingVisits.some(v => 
      v.outletId === input.outletId && 
      v.plannedDate.toISOString().split('T')[0]! === dateStr
    );

    if (hasDuplicate) {
      throw new Error(`Visit already scheduled for agent ${agentId} to outlet ${input.outletId} on ${dateStr}`);
    }

    const visitId = input.id ?? randomUUID();
    const visit = Visit.create({
      id: visitId,
      tenantId,
      agentId,
      outletId: input.outletId,
      journeyPlanId: input.journeyPlanId,
      plannedDate: new Date(input.plannedDate),
    });

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'visit.created',
      'v1',
      {
        visitId,
        agentId,
        outletId: visit.outletId,
        journeyPlanId: visit.journeyPlanId,
        plannedDate: visit.plannedDate.toISOString(),
      },
      {
        tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'sfa-service',
        partitionKey: visitId,
        causationId: activeCtx?.causationId,
      }
    );

    if (this.db) {
      try {
        await this.db.transaction(async (conn) => {
          const txDb = new TransactionalDbClient(conn);
          const txRepo = new VisitRepository(txDb);

          // 1. Save visit
          await txRepo.save(visit);

          // 2. Save event in outbox
          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'Visit', visitId);
        }, tenantId);
        this.logger.info('Persisted visit and created outbox event transactionally');
      } catch (err: any) {
        this.logger.warn('Failed database transaction, falling back to memory save', { error: err.message });
        await activeRepo.save(visit);
      }
    } else {
      await activeRepo.save(visit);
    }

    return {
      visitId,
      status: visit.status,
    };
  }
}
