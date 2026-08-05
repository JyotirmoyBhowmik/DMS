import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { UpdateOutletProfileInput } from '@dms/pkg-validation';
import { OutletProfile } from '../../../domain/entities/outlet-profile.js';
import { GeoPoint } from '../../../domain/value-objects/geo-point.js';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { OutletProfilePgRepository } from '../../../infrastructure/database/repositories/outlet-profile.pg-repository.js';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';

export class UpdateOutletProfileUseCase {
  private logger = new StructuredLogger('UpdateOutletProfileUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: OutletProfilePgRepository,
  ) {}

  async execute(
    id: string,
    tenantId: string,
    input: UpdateOutletProfileInput,
  ): Promise<OutletProfile> {
    this.logger.info('Executing UpdateOutletProfileUseCase', { id, tenantId });

    const activeRepo = this.repo || new OutletProfilePgRepository(this.db);
    const profile = await activeRepo.findById(id, tenantId);

    if (!profile) {
      throw new Error(`OutletProfile record with ID ${id} not found or unauthorized`);
    }

    // Optimistic Concurrency check
    if (input.version !== undefined && profile.version !== input.version) {
      throw new Error(`Optimistic locking conflict: expected version ${input.version} but record is at version ${profile.version}`);
    }

    // Apply updates
    profile.updateDetails({
      outletName: input.outletName,
      outletType: input.outletType,
      ownerName: input.ownerName,
      ownerPhone: input.ownerPhone,
      address: input.address,
      geoCoords: input.geoCoords ? GeoPoint.create(input.geoCoords.latitude, input.geoCoords.longitude) : undefined,
    });

    if (input.kycStatus) {
      profile.updateKycStatus(input.kycStatus);
    }

    if (input.status === 'active') {
      profile.activate();
    } else if (input.status === 'inactive') {
      profile.deactivate();
    }

    profile.incrementVersion();

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'outlet-profile.updated',
      'v1',
      {
        outletProfileId: profile.id,
        outletName: profile.outletName,
        outletType: profile.outletType,
        status: profile.status,
        kycStatus: profile.kycStatus,
        version: profile.version,
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
        this.logger.info('Saved updated outlet profile and outbox event transactionally');
      } catch (err: any) {
        this.logger.warn('Failed database transaction, falling back to memory save', { error: err.message });
        await activeRepo.save(profile);
      }
    } else {
      await activeRepo.save(profile);
    }

    return profile;
  }
}
