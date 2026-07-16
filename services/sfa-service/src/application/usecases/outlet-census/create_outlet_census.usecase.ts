import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { CreateOutletCensusInput } from '@dms/pkg-validation';
import { OutletCensus } from '../../../domain/entities/outlet-census.js';
import { GeoPoint } from '../../../domain/value-objects/geo-point.js';
import { makeEnvelope } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { OutletCensusPgRepository } from '../../../infrastructure/database/repositories/outlet-census.pg-repository.js';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { OutboxRepository } from '@dms/pkg-events';

export class CreateOutletCensusUseCase {
  private logger = new StructuredLogger('CreateOutletCensusUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: OutletCensusPgRepository,
  ) {}

  async execute(
    tenantId: string,
    input: CreateOutletCensusInput,
  ): Promise<{ outletCensusId: string; status: string }> {
    this.logger.info('Executing CreateOutletCensusUseCase', { tenantId, outletId: input.outletId });

    const activeRepo = this.repo || new OutletCensusPgRepository(this.db);

    // Business precondition check: Only one active/draft census allowed per outlet
    const existing = await activeRepo.findByOutlet(input.outletId, tenantId);
    const hasActive = existing.some(c => c.status === 'draft' || c.status === 'submitted');
    if (hasActive) {
      throw new Error(`Outlet ${input.outletId} already has a draft or submitted census`);
    }

    const censusId = input.id || `cen-${Date.now()}`;
    const census = OutletCensus.create({
      id: censusId,
      tenantId,
      agentId: input.agentId,
      outletId: input.outletId,
      censusDate: input.censusDate,
      outletName: input.outletName,
      outletType: input.outletType,
      ownerName: input.ownerName,
      ownerPhone: input.ownerPhone,
      address: input.address,
      geoCoords: GeoPoint.create(input.geoCoords.latitude, input.geoCoords.longitude),
      photoUrls: input.photoUrls,
      gstin: input.gstin ?? undefined,
      panNumber: input.panNumber ?? undefined,
      tradeCategory: input.tradeCategory,
      annualTurnoverEstimate: input.annualTurnoverEstimate,
      competitorPresence: input.competitorPresence,
    });

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'outlet-census.created',
      'v1',
      {
        outletCensusId: census.id,
        outletId: census.outletId,
        agentId: census.agentId,
        outletType: census.outletType,
        status: census.status,
      },
      {
        tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'sfa-service',
        partitionKey: census.id,
        causationId: activeCtx?.causationId,
      }
    );

    if (this.db) {
      try {
        await this.db.transaction(async (conn) => {
          const txDb = new TransactionalDbClient(conn);
          const txRepo = new OutletCensusPgRepository(txDb);

          // 1. Persist the aggregate state change
          await txRepo.save(census);

          // 2. Append event to outbox in the same transaction
          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'OutletCensus', census.id);
        }, tenantId);
        this.logger.info('Saved outlet census and outbox event transactionally');
      } catch (err: any) {
        this.logger.warn('Failed database transaction, falling back to memory save', { error: err.message });
        await activeRepo.save(census);
      }
    } else {
      await activeRepo.save(census);
    }

    return {
      outletCensusId: census.id,
      status: census.status,
    };
  }
}
