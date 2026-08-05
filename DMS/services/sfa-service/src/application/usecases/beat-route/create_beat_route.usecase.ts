import { randomUUID } from 'node:crypto';
import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { CreateBeatRouteInput } from '@dms/pkg-validation';
import { BeatRoute } from '../../../domain/entities/beat-route.js';
import { makeEnvelope } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { BeatRoutePgRepository } from '../../../infrastructure/database/repositories/beat-route.pg-repository.js';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { OutboxRepository } from '@dms/pkg-events';

export class CreateBeatRouteUseCase {
  private logger = new StructuredLogger('CreateBeatRouteUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: BeatRoutePgRepository,
  ) {}

  async execute(tenantId: string, input: CreateBeatRouteInput): Promise<{ beatRouteId: string; status: string }> {
    this.logger.info('Executing CreateBeatRouteUseCase', { name: input.name, region: input.region });

    const activeRepo = this.repo || new BeatRoutePgRepository(this.db);

    // Business precondition check: route name must be unique within the region and tenant
    const existingRoutes = await activeRepo.findByRegion(input.region, tenantId);
    if (existingRoutes.some(r => r.name.toLowerCase() === input.name.toLowerCase())) {
      throw new Error(`Beat route with name "${input.name}" already exists in region "${input.region}"`);
    }

    const routeId = input.id ?? randomUUID();
    const route = BeatRoute.create({
      id: routeId,
      tenantId,
      name: input.name,
      region: input.region,
      assignedAgentIds: input.assignedAgentIds ?? [],
      outlets: input.outlets ?? [],
      frequency: input.frequency ?? 'daily',
    });

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'beat_route.created',
      'v1',
      {
        beatRouteId: routeId,
        name: route.name,
        region: route.region,
        totalOutlets: route.outlets.length,
      },
      {
        tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'sfa-service',
        partitionKey: routeId,
        causationId: activeCtx?.causationId,
      }
    );

    if (this.db) {
      try {
        await this.db.transaction(async (conn) => {
          const txDb = new TransactionalDbClient(conn);
          const txRepo = new BeatRoutePgRepository(txDb);

          // 1. Save BeatRoute
          await txRepo.save(route);

          // 2. Save event in outbox
          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'BeatRoute', routeId);
        }, tenantId);
        this.logger.info('Persisted BeatRoute and created outbox event transactionally');
      } catch (err: any) {
        this.logger.warn('Failed database transaction, falling back to memory save', { error: err.message });
        await activeRepo.save(route);
      }
    } else {
      await activeRepo.save(route);
    }

    return {
      beatRouteId: routeId,
      status: route.status,
    };
  }
}
