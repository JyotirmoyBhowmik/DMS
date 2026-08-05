import { SalesTargetRepository } from '../../../domain/repositories/sales-target.repository.js';
import { SalesTarget } from '../../../domain/entities/sales-target.js';
import { Money } from '../../../domain/value-objects/money.js';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { getCorrelation } from '@dms/pkg-logger';
import { randomUUID } from 'node:crypto';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { SalesTargetPgRepository } from '../../../infrastructure/database/repositories/sales-target.pg-repository.js';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';

export interface CreateSalesTargetDTO {
  id?: string;
  tenantId: string;
  agentId: string;
  periodMonth: number;
  periodYear: number;
  targetAmount: number;
  currency?: string;
  targetType: string;
}

export class CreateSalesTargetUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: SalesTargetRepository
  ) {}

  async execute(principal: Principal, dto: CreateSalesTargetDTO): Promise<SalesTarget> {
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== dto.tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    // Only Admin or Distributor can create targets, or require permission
    if (!RbacGuard.can(principal, 'sales_target:create') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to create sales targets');
    }

    const activeRepo = this.repo || new SalesTargetPgRepository(this.db);

    // Idempotency: check if exact target already exists for agent and period
    const existing = await activeRepo.findByAgentAndPeriod(dto.agentId, dto.periodMonth, dto.periodYear, dto.tenantId);
    const dup = existing.find((t) => t.targetType === dto.targetType);
    if (dup) {
      return dup;
    }

    const target = SalesTarget.create({
      id: dto.id || randomUUID(),
      tenantId: dto.tenantId,
      agentId: dto.agentId,
      periodMonth: dto.periodMonth,
      periodYear: dto.periodYear,
      targetAmount: Money.fromCents(Math.round(dto.targetAmount * 100)),
      targetType: dto.targetType,
      status: 'DRAFT',
    });

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'sfa.sales_target.created',
      'v1',
      {
        id: target.id,
        tenantId: target.tenantId,
        agentId: target.agentId,
        periodMonth: target.periodMonth,
        periodYear: target.periodYear,
        targetAmount: target.targetAmount.amount,
        targetType: target.targetType,
      },
      {
        tenantId: target.tenantId,
        correlationId: activeCtx?.correlationId ?? 'correlation-uuid-mock',
        producer: 'sfa-service',
        partitionKey: target.id,
        causationId: activeCtx?.causationId,
      }
    );

    if (this.db) {
      try {
        await this.db.transaction(async (conn) => {
          const txDb = new TransactionalDbClient(conn);
          const txRepo = new SalesTargetPgRepository(txDb);

          await txRepo.save(target, dto.tenantId);

          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId: dto.tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'SalesTarget', target.id);
        }, dto.tenantId);
      } catch {
        await activeRepo.save(target, dto.tenantId);
      }
    } else {
      await activeRepo.save(target, dto.tenantId);
    }

    await recordAudit(
      principal.id,
      dto.tenantId,
      'sales_target.created',
      `Sales target created for agent ${target.agentId} in period ${target.periodYear}-${target.periodMonth}`,
      { before: null, after: target.toJSON() }
    );

    return target;
  }
}
