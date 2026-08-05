import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { CreateOutletProfileInput } from '@dms/pkg-validation';
import { OutletProfile } from '../../../domain/entities/outlet-profile.js';
import { GeoPoint } from '../../../domain/value-objects/geo-point.js';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { OutletProfilePgRepository } from '../../../infrastructure/database/repositories/outlet-profile.pg-repository.js';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';

export class CreateOutletProfileUseCase {
  private logger = new StructuredLogger('CreateOutletProfileUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: OutletProfilePgRepository,
  ) {}

  async execute(
    tenantId: string,
    input: CreateOutletProfileInput,
  ): Promise<{ outletProfileId: string; status: string }> {
    this.logger.info('Executing CreateOutletProfileUseCase', { tenantId, outletName: input.outletName });

    const activeRepo = this.repo || new OutletProfilePgRepository(this.db);
    const profileId = input.id || `prof-${Date.now()}`;
    const profile = OutletProfile.create({
      id: profileId,
      tenantId,
      outletName: input.outletName,
      outletType: input.outletType,
      ownerName: input.ownerName,
      ownerPhone: input.ownerPhone,
      address: input.address,
      geoCoords: GeoPoint.create(input.geoCoords.latitude, input.geoCoords.longitude),
      kycStatus: input.kycStatus,
      status: input.status,
    });

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'outlet-profile.created',
      'v1',
      {
        outletProfileId: profile.id,
        outletName: profile.outletName,
        outletType: profile.outletType,
        status: profile.status,
      },
      {
        tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'sfa-service',
        partitionKey: profile.id,
        causationId: activeCtx?.causationId,
      }
    );

    if (this.db) {
      try {
        await this.db.transaction(async (conn) => {
          const txDb = new TransactionalDbClient(conn);
          const txRepo = new OutletProfilePgRepository(txDb);

          await txRepo.save(profile);

          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'OutletProfile', profile.id);
        }, tenantId);
        this.logger.info('Saved outlet profile and outbox event transactionally');
      } catch (err: any) {
        this.logger.warn('Failed database transaction, falling back to memory save', { error: err.message });
        await activeRepo.save(profile);
      }
    } else {
      await activeRepo.save(profile);
    }

    return {
      outletProfileId: profile.id,
      status: profile.status,
    };
  }
}
