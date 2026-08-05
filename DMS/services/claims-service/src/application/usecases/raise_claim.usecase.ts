import { randomUUID } from 'node:crypto';
import { StructuredLogger, getCorrelation } from '@dms/pkg-logger';
import { ClaimEntity } from '../../domain/entities/claim.entity.js';
import { ClaimAggregate } from '../../domain/aggregates/claim.aggregate.js';
import { makeEnvelope } from '@dms/pkg-events';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { IClaimRepository } from '../../domain/repositories/claim.repository.js';
import { ClaimPgRepository } from '../../infrastructure/database/repositories/claim.pg-repository.js';
import { TransactionalDbClient } from '../../infrastructure/database/transactional-client.js';
import { OutboxRepository } from '@dms/pkg-events';
import { z } from 'zod';

export const RaiseClaimInputSchema = z.object({
  id: z.string().uuid().optional(),
  distributorId: z.string().uuid(),
  schemeId: z.string().uuid(),
  amount: z.number().int().positive('Amount must be positive'),
  duplicateCheckKey: z.string().min(1).optional(),
});

export type RaiseClaimInput = z.infer<typeof RaiseClaimInputSchema>;

export class RaiseClaimUseCase {
  private logger = new StructuredLogger('RaiseClaimUseCase');
  private outboxRepo = new OutboxRepository({ tableName: 'claims_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly claimRepo?: IClaimRepository,
  ) {}

  async execute(tenantId: string, input: RaiseClaimInput, actorId: string): Promise<{ claimId: string }> {
    this.logger.info('Raising a new claim', { distributorId: input.distributorId, schemeId: input.schemeId });

    const parsedInput = RaiseClaimInputSchema.parse(input);
    const claimId = parsedInput.id || randomUUID();

    const entity = new ClaimEntity({
      id: claimId,
      tenantId,
      distributorId: parsedInput.distributorId,
      schemeId: parsedInput.schemeId,
      amount: parsedInput.amount,
      settledAmount: 0,
      status: 'raised',
      duplicateCheckKey: parsedInput.duplicateCheckKey,
    });

    const aggregate = new ClaimAggregate(entity);
    aggregate.raise();

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'claim.raised',
      'v1',
      {
        claimId,
        distributorId: entity.distributorId,
        schemeId: entity.schemeId,
        amount: entity.amount,
      },
      {
        tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'claims-service',
        partitionKey: claimId,
        causationId: activeCtx?.causationId,
      }
    );

    if (this.db) {
      await this.db.transaction(async (conn) => {
        const txDb = new TransactionalDbClient(conn);
        const txRepo = this.claimRepo || new ClaimPgRepository(txDb);

        // 1. Save claim
        await txRepo.save(entity as any, tenantId);


        // 2. Record audit log
        const auditSql = `
          INSERT INTO claim_audit_history (tenant_id, claim_id, action, actor_id, prev_status, new_status, payload)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        await conn.query(auditSql, [
          tenantId,
          claimId,
          'raised',
          actorId,
          null,
          'raised',
          JSON.stringify({ amount: entity.amount }),
        ]);

        // 3. Save outbox event
        await this.outboxRepo.save(conn, {
          eventId: event.eventId,
          tenantId,
          type: event.type,
          version: 'v1',
          payload: event.payload,
        }, 'Claim', claimId);
      }, tenantId);
      this.logger.info('Claim raised successfully inside transaction');
    }

    return { claimId };
  }
}
