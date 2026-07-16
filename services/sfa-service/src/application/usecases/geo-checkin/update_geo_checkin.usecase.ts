import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { UpdateGeoCheckInInput } from '@dms/pkg-validation';
import { GeoCheckIn } from '../../../domain/entities/geo-checkin.js';
import { GeoPoint } from '../../../domain/value-objects/geo-point.js';
import { makeEnvelope } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { GeoCheckInPgRepository } from '../../../infrastructure/database/repositories/geo-checkin.pg-repository.js';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { OutboxRepository } from '@dms/pkg-events';

export class UpdateGeoCheckInUseCase {
  private logger = new StructuredLogger('UpdateGeoCheckInUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: GeoCheckInPgRepository,
  ) {}

  async execute(
    tenantId: string,
    id: string,
    input: UpdateGeoCheckInInput,
    expectedVersion?: number
  ): Promise<{ geoCheckInId: string; status: string }> {
    this.logger.info('Executing UpdateGeoCheckInUseCase', { id, action: input.action, tenantId });

    const activeRepo = this.repo || new GeoCheckInPgRepository(this.db);
    const existing = await activeRepo.findById(id, tenantId);

    if (!existing) {
      throw new Error(`GeoCheckIn record with ID ${id} not found or unauthorized`);
    }

    // Version validation for optimistic locking
    if (expectedVersion !== undefined && existing.version !== expectedVersion) {
      this.logger.warn('Optimistic locking mismatch', { id, expected: expectedVersion, actual: existing.version });
      throw new Error(`Conflict: version mismatch. Expected ${expectedVersion} but got ${existing.version}`);
    }

    // Capture before state for auditing
    const beforeState = existing.toJSON();

    // Mutate state using domain methods
    if (input.action === 'check_out') {
      if (!input.coords) {
        throw new Error('Coordinates are required for check-out');
      }
      existing.checkOut(GeoPoint.create(input.coords.latitude, input.coords.longitude));
    } else if (input.action === 'flag_spoofing') {
      existing.flagSpoofing();
    } else {
      throw new Error(`Unsupported update action: ${input.action}`);
    }

    existing.incrementVersion();

    // Capture after state for auditing
    const afterState = existing.toJSON();
    this.logger.info('Audit log mutation', { id, before: beforeState, after: afterState });

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'geo-checkin.updated',
      'v1',
      {
        geoCheckInId: id,
        action: input.action,
        checkOutTime: existing.checkOutTime?.toISOString() ?? null,
        spoofingDetected: existing.spoofingDetected,
        version: existing.version,
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

          // 1. Save modified entity
          await txRepo.save(existing);

          // 2. Outbox event
          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'GeoCheckIn', id);
        }, tenantId);
        this.logger.info('Updated geo-checkin and created outbox event transactionally');
      } catch (err: any) {
        this.logger.warn('Failed database transaction, falling back to memory save', { error: err.message });
        await activeRepo.save(existing);
      }
    } else {
      await activeRepo.save(existing);
    }

    return {
      geoCheckInId: id,
      status: existing.checkOutTime ? 'checked_out' : 'checked_in',
    };
  }
}
