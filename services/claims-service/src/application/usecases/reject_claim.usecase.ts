import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { ClaimAggregate } from '../../domain/aggregates/claim.aggregate.js';
import { makeEnvelope } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { IClaimRepository } from '../../domain/repositories/claim.repository.js';
import { ClaimPgRepository } from '../../infrastructure/database/repositories/claim.pg-repository.js';
import { TransactionalDbClient } from '../../infrastructure/database/transactional-client.js';
import { OutboxRepository } from '@dms/pkg-events';

export class RejectClaimUseCase {
  private logger = new StructuredLogger('RejectClaimUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'claims_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly claimRepo?: IClaimRepository,
  ) {}

  async execute(tenantId: string, claimId: string, actorId: string, remarks?: string): Promise<{ status: string }> {
    this.logger.info('Rejecting claim', { claimId });

    if (!this.db) {
      throw new Error('Database client required for reject use case');
    }

    const result = await this.db.transaction(async (conn) => {
      const txDb = new TransactionalDbClient(conn);
      const txRepo = this.claimRepo || new ClaimPgRepository(txDb);

      // 1. Fetch claim
      const entity = await txRepo.findById(claimId, tenantId);
      const aggregate = new ClaimAggregate(entity);
      const prevStatus = entity.status;

      // 2. Perform state transition
      aggregate.reject();

      // 3. Update in database (optimistic locking)
      await txRepo.update(entity, tenantId);

      // 4. Record audit log
      const auditSql = `
        INSERT INTO claim_audit_history (tenant_id, claim_id, action, actor_id, prev_status, new_status, payload)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      await conn.query(auditSql, [
        tenantId,
        claimId,
        'reject',
        actorId,
        prevStatus,
        entity.status,
        JSON.stringify({ remarks: remarks || 'Manual rejection' }),
      ]);

      // 5. Register outbox event
      const activeCtx = getCorrelation();
      const event = makeEnvelope(
        'claim.rejected',
        'v1',
        {
          claimId,
          status: entity.status,
          remarks: remarks || 'Manual rejection',
        },
        {
          tenantId,
          correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
          producer: 'claims-service',
          partitionKey: claimId,
          causationId: activeCtx?.causationId,
        }
      );

      await this.outboxRepo.save(conn, {
        eventId: event.eventId,
        tenantId,
        type: event.type,
        version: 'v1',
        payload: event.payload,
      }, 'Claim', claimId);

      return entity.status;
    }, tenantId);

    return { status: result };
  }
}
