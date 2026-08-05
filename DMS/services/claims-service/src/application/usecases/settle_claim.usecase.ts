import { randomUUID } from 'node:crypto';
import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { ClaimAggregate } from '../../domain/aggregates/claim.aggregate.js';
import { makeEnvelope } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { IClaimRepository } from '../../domain/repositories/claim.repository.js';
import { ClaimPgRepository } from '../../infrastructure/database/repositories/claim.pg-repository.js';
import { TransactionalDbClient } from '../../infrastructure/database/transactional-client.js';
import { OutboxRepository } from '@dms/pkg-events';
import { z } from 'zod';

export const SettleClaimInputSchema = z.object({
  claimId: z.string().uuid(),
  amount: z.number().int().positive('Amount must be positive'),
  idempotencyKey: z.string().min(1),
});

export type SettleClaimInput = z.infer<typeof SettleClaimInputSchema>;

export class SettleClaimUseCase {
  private logger = new StructuredLogger('SettleClaimUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'claims_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly claimRepo?: IClaimRepository,
  ) {}

  async execute(
    tenantId: string,
    input: SettleClaimInput,
    actorId: string
  ): Promise<{ transactionId: string; status: string; claimId: string; amount: number }> {
    this.logger.info('Settling claim', { claimId: input.claimId, amount: input.amount, idempotencyKey: input.idempotencyKey });

    const parsedInput = SettleClaimInputSchema.parse(input);
    const { claimId, amount, idempotencyKey } = parsedInput;

    if (!this.db) {
      throw new Error('Database client required for settle use case');
    }

    return this.db.transaction(async (conn) => {
      // 1. Idempotency check: look up existing settlement transaction
      const existingTxRes = await conn.query(
        `SELECT * FROM claim_settlement_transactions WHERE tenant_id = $1 AND idempotency_key = $2`,
        [tenantId, idempotencyKey]
      );
      if (existingTxRes.rows && existingTxRes.rows.length > 0) {
        const tx = existingTxRes.rows[0] as any;
        if (tx.status === 'success') {
          this.logger.info('Idempotent settlement request: returning existing transaction', { idempotencyKey });
          return {
            transactionId: tx.id,
            status: tx.status,
            claimId: tx.claim_id,
            amount: Number(tx.amount),
          };
        }
      }

      const txDb = new TransactionalDbClient(conn);
      const txRepo = this.claimRepo || new ClaimPgRepository(txDb);

      // 2. Fetch claim
      const entity: any = await txRepo.findById(claimId, tenantId);
      if (!entity) {
        throw new Error(`Claim ${claimId} not found`);
      }
      const aggregate = new ClaimAggregate(entity);
      const prevStatus = entity.status;
      const prevSettledAmount = entity.settledAmount;


      // 3. Perform state transition and validate
      aggregate.settle(amount);

      // 4. Update in database (optimistic locking checked via version)
      await txRepo.update(entity, tenantId);

      // 5. Save settlement transaction
      const transactionId = randomUUID();
      await conn.query(
        `INSERT INTO claim_settlement_transactions (id, tenant_id, claim_id, idempotency_key, amount, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [transactionId, tenantId, claimId, idempotencyKey, amount, 'success']
      );

      // 6. Record audit log
      const auditSql = `
        INSERT INTO claim_audit_history (tenant_id, claim_id, action, actor_id, prev_status, new_status, payload)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      await conn.query(auditSql, [
        tenantId,
        claimId,
        'settle',
        actorId,
        prevStatus,
        entity.status,
        JSON.stringify({ amount, prevSettledAmount, newSettledAmount: entity.settledAmount, idempotencyKey }),
      ]);

      // 7. Register outbox event
      const activeCtx = getCorrelation();
      const event = makeEnvelope(
        'claim.settled',
        'v1',
        {
          claimId,
          status: entity.status,
          amount,
          settledAmount: entity.settledAmount,
          idempotencyKey,
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

      return {
        transactionId,
        status: 'success',
        claimId,
        amount,
      };
    }, tenantId);
  }
}
