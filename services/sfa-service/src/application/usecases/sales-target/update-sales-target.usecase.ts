import { SalesTargetRepository } from '../../../domain/repositories/sales-target.repository.js';
import { SalesTarget, SalesTargetStatus } from '../../../domain/entities/sales-target.js';
import { Money } from '../../../domain/value-objects/money.js';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { getCorrelation } from '@dms/pkg-logger';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { SalesTargetPgRepository } from '../../../infrastructure/database/repositories/sales-target.pg-repository.js';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';

export interface UpdateSalesTargetDTO {
  id: string;
  tenantId: string;
  targetAmount?: number;
  currency?: string;
  status?: SalesTargetStatus;
  achievedAmount?: number; // Direct setting or progressive addition
  addAchievementAmount?: number;
  version: number;
}

export class UpdateSalesTargetUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: SalesTargetRepository
  ) {}

  async execute(principal: Principal, dto: UpdateSalesTargetDTO): Promise<SalesTarget> {
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== dto.tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }

    const activeRepo = this.repo || new SalesTargetPgRepository(this.db);
    const target = await activeRepo.findById(dto.id, dto.tenantId);

    if (!target || target.tenantId !== dto.tenantId) {
      throw new Error(`Sales target with ID ${dto.id} not found`);
    }

    if (target.version !== dto.version) {
      throw new Error(`Optimistic locking conflict: version mismatch. DB version ${target.version}, requested version ${dto.version}`);
    }

    const originalState = target.toJSON();

    // Check RBAC: only Admin/Distributor can change target amounts or statuses
    if (dto.targetAmount !== undefined || dto.status !== undefined || dto.achievedAmount !== undefined) {
      if (!RbacGuard.can(principal, 'sales_target:update') && !principal.roles.includes('admin')) {
        throw new Error('Forbidden: Insufficient permissions to update sales target');
      }
    }

    // Apply mutations based on domain rules
    if (dto.targetAmount !== undefined) {
      target.updateTargetAmount(Money.fromCents(Math.round(dto.targetAmount * 100)));
    }

    // Set achieved amount directly (admin override)
    if (dto.achievedAmount !== undefined) {
      (target as any).props.achievedAmount = Money.fromCents(Math.round(dto.achievedAmount * 100));
      (target as any).props.updatedAt = new Date();
      if (target.progressPercentage >= 100 && target.status === 'ACTIVE') {
        target.complete();
      }
    }

    // Progressive achievement addition (e.g. from event consumers or order integrations)
    if (dto.addAchievementAmount !== undefined) {
      // Achievement additions require ACTIVE state
      target.addAchievement(Money.fromCents(Math.round(dto.addAchievementAmount * 100)));
    }

    // Status transitions
    if (dto.status === 'ACTIVE') {
      target.activate();
    } else if (dto.status === 'COMPLETED') {
      target.complete();
    } else if (dto.status === 'CANCELLED') {
      target.cancel();
    } else if (dto.status === 'EXPIRED') {
      target.expire();
    }

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'sfa.sales_target.updated',
      'v1',
      {
        id: target.id,
        tenantId: target.tenantId,
        agentId: target.agentId,
        status: target.status,
        achievedAmount: target.achievedAmount.amount,
        progressPercentage: target.progressPercentage,
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

    target.incrementVersion();

    await recordAudit(
      principal.id,
      dto.tenantId,
      'sales_target.updated',
      `Sales target updated to status ${target.status} with achievement progress ${target.progressPercentage}%`,
      { before: originalState, after: target.toJSON() }
    );

    return target;
  }
}
