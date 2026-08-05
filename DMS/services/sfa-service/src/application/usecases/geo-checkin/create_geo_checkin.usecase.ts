import { randomUUID } from 'node:crypto';
import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { CreateGeoCheckInInput } from '@dms/pkg-validation';
import { GeoCheckIn } from '../../../domain/entities/geo-checkin.js';
import { GeoPoint } from '../../../domain/value-objects/geo-point.js';
import { makeEnvelope } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { GeoCheckInPgRepository } from '../../../infrastructure/database/repositories/geo-checkin.pg-repository.js';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { OutboxRepository } from '@dms/pkg-events';

export class CreateGeoCheckInUseCase {
  private logger = new StructuredLogger('CreateGeoCheckInUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: GeoCheckInPgRepository,
  ) {}

  async execute(tenantId: string, input: CreateGeoCheckInInput): Promise<{ geoCheckInId: string; isWithinGeofence: boolean }> {
    this.logger.info('Executing CreateGeoCheckInUseCase', { agentId: input.agentId, outletId: input.outletId });

    const activeRepo = this.repo || new GeoCheckInPgRepository(this.db);

    const id = input.id ?? randomUUID();
    const geoCheckIn = GeoCheckIn.create({
      id,
      tenantId,
      agentId: input.agentId,
      outletId: input.outletId,
      visitId: input.visitId,
      checkInCoords: GeoPoint.create(input.checkInCoords.latitude, input.checkInCoords.longitude),
      outletCoords: GeoPoint.create(input.outletCoords.latitude, input.outletCoords.longitude),
      deviceInfo: input.deviceInfo,
      geofenceRadiusM: input.geofenceRadiusM,
      spoofingDetected: input.spoofingDetected,
    });

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'geo-checkin.created',
      'v1',
      {
        geoCheckInId: id,
        agentId: geoCheckIn.agentId,
        outletId: geoCheckIn.outletId,
        visitId: geoCheckIn.visitId,
        checkInTime: geoCheckIn.checkInTime.toISOString(),
        isWithinGeofence: geoCheckIn.isWithinGeofence,
        spoofingDetected: geoCheckIn.spoofingDetected,
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
          const txRepo = new GeoCheckInPgRepository(txDb);

          // 1. Save geo-checkin
          await txRepo.save(geoCheckIn);

          // 2. Save event in outbox
          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'GeoCheckIn', id);
        }, tenantId);
        this.logger.info('Persisted geo-checkin and created outbox event transactionally');
      } catch (err: any) {
        this.logger.warn('Failed database transaction, falling back to memory save', { error: err.message });
        await activeRepo.save(geoCheckIn);
      }
    } else {
      await activeRepo.save(geoCheckIn);
    }

    return {
      geoCheckInId: id,
      isWithinGeofence: geoCheckIn.isWithinGeofence,
    };
  }
}
