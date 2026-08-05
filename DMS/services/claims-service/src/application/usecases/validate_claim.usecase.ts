import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { ClaimAggregate } from '../../domain/aggregates/claim.aggregate.js';
import { makeEnvelope } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { IClaimRepository } from '../../domain/repositories/claim.repository.js';
import { ClaimPgRepository } from '../../infrastructure/database/repositories/claim.pg-repository.js';
import { TransactionalDbClient } from '../../infrastructure/database/transactional-client.js';
import { OutboxRepository } from '@dms/pkg-events';

export class ValidateClaimUseCase {
  private logger = new StructuredLogger('ValidateClaimUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'claims_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly claimRepo?: IClaimRepository,
  ) {}

  async execute(tenantId: string, claimId: string, actorId: string): Promise<{ status: string }> {
    this.logger.info('Validating claim', { claimId });

    if (!this.db) {
      throw new Error('Database client required for validation use case');
    }

    const result = await this.db.transaction(async (conn) => {
      const txDb = new TransactionalDbClient(conn);
      const txRepo = this.claimRepo || new ClaimPgRepository(txDb);

      // 1. Fetch claim
      const entity: any = await txRepo.findById(claimId, tenantId);
      if (!entity) {
        throw new Error(`Claim ${claimId} not found`);
      }
      const aggregate = new ClaimAggregate(entity);
      const prevStatus = entity.status;


      // 2. Reconcile against Scheme
      const schemeRes = await conn.query(
        `SELECT * FROM schemes WHERE id = $1 AND tenant_id = $2`,
        [entity.schemeId, tenantId]
      );
      const scheme = (schemeRes.rows && schemeRes.rows[0]) as any;

      let reconStatus: 'success' | 'mismatch' | 'failed' = 'success';
      let remarks = 'Reconciled successfully against active scheme';

      if (!scheme) {
        reconStatus = 'failed';
        remarks = `Reconciliation failed: Scheme ${entity.schemeId} not found`;
      } else if (scheme.status !== 'active') {
        reconStatus = 'mismatch';
        remarks = `Reconciliation failed: Scheme status is ${scheme.status}, expected active`;
      }

      // 3. Record reconciliation log
      const reconSql = `
        INSERT INTO claim_reconciliations (tenant_id, claim_id, scheme_id, status, remarks)
        VALUES ($1, $2, $3, $4, $5)
      `;
      await conn.query(reconSql, [tenantId, claimId, entity.schemeId, reconStatus, remarks]);

      const activeCtx = getCorrelation();
      let eventType = 'claim.validated';

      if (reconStatus === 'success') {
        aggregate.validate();
      } else {
        aggregate.reject();
        eventType = 'claim.rejected';
      }

      // 4. Update claim in database
      await txRepo.update(entity, tenantId);

      // 5. Record audit log
      const auditSql = `
        INSERT INTO claim_audit_history (tenant_id, claim_id, action, actor_id, prev_status, new_status, payload)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      await conn.query(auditSql, [
        tenantId,
        claimId,
        reconStatus === 'success' ? 'validate' : 'reject',
        actorId,
        prevStatus,
        entity.status,
        JSON.stringify({ reconStatus, remarks }),
      ]);

      // 6. Save outbox event
      const event = makeEnvelope(
        eventType,
        'v1',
        {
          claimId,
          status: entity.status,
          remarks,
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
