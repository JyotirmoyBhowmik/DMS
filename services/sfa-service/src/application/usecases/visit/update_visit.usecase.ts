import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { UpdateVisitInput } from '@dms/pkg-validation';
import { Visit } from '../../../domain/entities/visit.js';
import { GeoPoint } from '../../../domain/value-objects/geo-point.js';
import { makeEnvelope } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { VisitRepository } from '../../../infrastructure/database/repositories/visit.repository.js';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { OutboxRepository } from '@dms/pkg-events';

export class UpdateVisitUseCase {
  private logger = new StructuredLogger('UpdateVisitUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: VisitRepository,
  ) {}

  async execute(
    tenantId: string,
    id: string,
    input: UpdateVisitInput
  ): Promise<{ visitId: string; status: string }> {
    this.logger.info('Executing UpdateVisitUseCase', { id, action: input.action });

    const activeRepo = this.repo || new VisitRepository(this.db);
    const visit = await activeRepo.findById(id, tenantId);

    if (!visit) {
      throw new Error(`Visit with ID ${id} not found`);
    }

    const beforeState = visit.toJSON();

    // Perform aggregate transitions
    if (input.action === 'check_in') {
      if (!input.location) throw new Error('location is required for check-in');
      const point = GeoPoint.create(input.location.latitude, input.location.longitude);
      visit.checkIn(point);
    } else if (input.action === 'check_out') {
      if (!input.location) throw new Error('location is required for check-out');
      const point = GeoPoint.create(input.location.latitude, input.location.longitude);
      visit.checkOut(point);
    } else if (input.action === 'record_task') {
      if (!input.task) throw new Error('task is required to record visit task');
      visit.recordTask({
        taskId: input.task.taskId,
        taskType: input.task.taskType,
        notes: input.task.notes || '',
        completedAt: new Date(),
      });
    } else if (input.action === 'skip') {
      visit.skip();
    } else {
      throw new Error(`Unsupported update action: ${input.action}`);
    }

    visit.incrementVersion();

    const activeCtx = getCorrelation();
    const eventType = visit.status === 'completed' ? 'visit.completed' : 'visit.updated';
    const event = makeEnvelope(
      eventType,
      'v1',
      {
        visitId: id,
        action: input.action,
        status: visit.status,
        version: visit.version,
      },
      {
        tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'sfa-service',
        partitionKey: id,
        causationId: activeCtx?.causationId,
      }
    );

    if (this.db) {
      try {
        await this.db.transaction(async (conn) => {
          const txDb = new TransactionalDbClient(conn);
          const txRepo = new VisitRepository(txDb);

          // Save update
          await txRepo.save(visit);

          // Write outbox event
          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'Visit', id);
        }, tenantId);
        this.logger.info('Persisted visit update transactionally');
      } catch (err: any) {
        this.logger.warn('Failed database transaction update, falling back to memory update', { error: err.message });
        await activeRepo.save(visit);
      }
    } else {
      await activeRepo.save(visit);
    }

    // SOC 2 Audit hooks
    this.logger.info('Visit mutated successfully', {
      visitId: id,
      before: beforeState,
      after: visit.toJSON(),
    });

    return {
      visitId: id,
      status: visit.status,
    };
  }
}
