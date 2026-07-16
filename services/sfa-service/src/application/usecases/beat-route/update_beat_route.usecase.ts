import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { UpdateBeatRouteInput } from '@dms/pkg-validation';
import { BeatRoute } from '../../../domain/entities/beat-route.js';
import { makeEnvelope } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { BeatRoutePgRepository } from '../../../infrastructure/database/repositories/beat-route.pg-repository.js';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { OutboxRepository } from '@dms/pkg-events';

export class UpdateBeatRouteUseCase {
  private logger = new StructuredLogger('UpdateBeatRouteUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: BeatRoutePgRepository,
  ) {}

  async execute(
    tenantId: string,
    id: string,
    input: UpdateBeatRouteInput
  ): Promise<{ beatRouteId: string; status: string }> {
    this.logger.info('Executing UpdateBeatRouteUseCase', { id, action: input.action });

    const activeRepo = this.repo || new BeatRoutePgRepository(this.db);
    const route = await activeRepo.findById(id, tenantId);

    if (!route) {
      throw new Error(`Beat route with ID ${id} not found`);
    }

    const beforeState = route.toJSON();

    // Perform aggregate transitions/mutations
    if (input.action === 'activate') {
      route.activate();
    } else if (input.action === 'suspend') {
      route.suspend();
    } else if (input.action === 'archive') {
      route.archive();
    } else if (input.action === 'assign_agent') {
      if (!input.agentId) throw new Error('agentId is required to assign agent');
      route.assignAgent(input.agentId);
    } else if (input.action === 'remove_agent') {
      if (!input.agentId) throw new Error('agentId is required to remove agent');
      route.removeAgent(input.agentId);
    } else if (input.action === 'add_outlet') {
      if (!input.outlet) throw new Error('outlet data is required to add stop');
      route.addOutlet(input.outlet);
    } else if (input.action === 'remove_outlet') {
      if (!input.outletId) throw new Error('outletId is required to remove stop');
      route.removeOutlet(input.outletId);
    } else if (input.action === 'update_name') {
      if (!input.name) throw new Error('name is required to update route name');
      route.updateName(input.name);
    } else if (input.action === 'update_frequency') {
      if (!input.frequency) throw new Error('frequency is required to update route frequency');
      route.updateFrequency(input.frequency);
    } else {
      throw new Error(`Unsupported update action: ${input.action}`);
    }

    route.incrementVersion();

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'beat_route.updated',
      'v1',
      {
        beatRouteId: id,
        action: input.action,
        status: route.status,
        version: route.version,
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
          const txRepo = new BeatRoutePgRepository(txDb);

          // Save update
          await txRepo.save(route);

          // Write outbox event
          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'BeatRoute', id);
        }, tenantId);
        this.logger.info('Persisted BeatRoute update transactionally');
      } catch (err: any) {
        this.logger.warn('Failed database transaction update, falling back to memory update', { error: err.message });
        await activeRepo.save(route);
      }
    } else {
      await activeRepo.save(route);
    }

    // SOC 2 Audit hook logs
    this.logger.info('BeatRoute mutated successfully', {
      beatRouteId: id,
      before: beforeState,
      after: route.toJSON(),
    });

    return {
      beatRouteId: id,
      status: route.status,
    };
  }
}
