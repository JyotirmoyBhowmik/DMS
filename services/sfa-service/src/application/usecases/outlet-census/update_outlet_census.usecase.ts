import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { UpdateOutletCensusInput } from '@dms/pkg-validation';
import { OutletCensus, KycStatus } from '../../../domain/entities/outlet-census.js';
import { makeEnvelope } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { OutletCensusPgRepository } from '../../../infrastructure/database/repositories/outlet-census.pg-repository.js';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { OutboxRepository } from '@dms/pkg-events';

export class UpdateOutletCensusUseCase {
  private logger = new StructuredLogger('UpdateOutletCensusUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: OutletCensusPgRepository,
  ) {}

  async execute(
    tenantId: string,
    id: string,
    input: UpdateOutletCensusInput,
    expectedVersion?: number
  ): Promise<{ outletCensusId: string; status: string }> {
    this.logger.info('Executing UpdateOutletCensusUseCase', { id, action: input.action, tenantId });

    const activeRepo = this.repo || new OutletCensusPgRepository(this.db);
    const existing = await activeRepo.findById(id, tenantId);

    if (!existing) {
      throw new Error(`OutletCensus record with ID ${id} not found or unauthorized`);
    }

    // Version concurrency lock check
    if (expectedVersion !== undefined && existing.version !== expectedVersion) {
      this.logger.warn('Optimistic locking mismatch', { id, expected: expectedVersion, actual: existing.version });
      throw new Error(`Conflict: version mismatch. Expected ${expectedVersion} but got ${existing.version}`);
    }

    const beforeState = existing.toJSON();

    // Mutate state based on action
    switch (input.action) {
      case 'submit':
        existing.submit();
        break;
      case 'verify':
        existing.verify();
        break;
      case 'approve':
        existing.approve();
        break;
      case 'reject':
        existing.reject();
        break;
      case 'update_kyc':
        if (!input.kycStatus) throw new Error('kycStatus is required for update_kyc action');
        existing.updateKyc(input.kycStatus as KycStatus, input.gstin, input.panNumber);
        break;
      case 'add_photo':
        if (!input.photoUrl) throw new Error('photoUrl is required for add_photo action');
        existing.addPhoto(input.photoUrl);
        break;
      case 'update_competitors':
        if (!input.competitors) throw new Error('competitors array is required for update_competitors action');
        existing.updateCompetitorPresence(input.competitors);
        break;
      default:
        throw new Error(`Unsupported action: ${input.action}`);
    }

    existing.incrementVersion();

    const afterState = existing.toJSON();
    this.logger.info('Audit log mutation', { id, before: beforeState, after: afterState });

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'outlet-census.updated',
      'v1',
      {
        outletCensusId: id,
        action: input.action,
        status: existing.status,
        kycStatus: existing.kycStatus,
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
          const txRepo = new OutletCensusPgRepository(txDb);

          // 1. Save state mutation
          await txRepo.save(existing);

          // 2. Write outbox event in the SAME transaction
          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'OutletCensus', id);
        }, tenantId);
        this.logger.info('Updated outlet census and created outbox event transactionally');
      } catch (err: any) {
        this.logger.warn('Failed database transaction, falling back to memory save', { error: err.message });
        await activeRepo.save(existing);
      }
    } else {
      await activeRepo.save(existing);
    }

    return {
      outletCensusId: id,
      status: existing.status,
    };
  }
}
