import { KPIAchievementRepository } from '../../../domain/repositories/kpi-achievement.repository.js';
import { KPIAchievement } from '../../../domain/entities/kpi-achievement.js';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { getCorrelation } from '@dms/pkg-logger';
import { randomUUID } from 'node:crypto';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { KPIAchievementPgRepository } from '../../../infrastructure/database/repositories/kpi-achievement.pg-repository.js';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';

export interface CreateKPIAchievementDTO {
  id?: string;
  tenantId: string;
  agentId: string;
  kpiType: string;
  periodMonth: number;
  periodYear: number;
  targetValue: number;
}

export class CreateKPIAchievementUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: KPIAchievementRepository
  ) {}

  async execute(principal: Principal, dto: CreateKPIAchievementDTO): Promise<KPIAchievement> {
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== dto.tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    // Only Admin or Distributor can create targets, or require permission
    if (!RbacGuard.can(principal, 'kpi_achievement:create') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to create KPI targets');
    }

    const activeRepo = this.repo || new KPIAchievementPgRepository(this.db);

    // Idempotency: check if exact target already exists for agent and period
    const existing = await activeRepo.findByAgentAndPeriod(dto.agentId, dto.periodMonth, dto.periodYear, dto.tenantId);
    const dup = existing.find((t) => t.kpiType === dto.kpiType);
    if (dup) {
      return dup;
    }

    const target = KPIAchievement.create({
      id: dto.id || randomUUID(),
      tenantId: dto.tenantId,
      agentId: dto.agentId,
      kpiType: dto.kpiType,
      periodMonth: dto.periodMonth,
      periodYear: dto.periodYear,
      targetValue: dto.targetValue,
      status: 'DRAFT',
    });

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'sfa.kpi_achievement.created',
      'v1',
      {
        id: target.id,
        tenantId: target.tenantId,
        agentId: target.agentId,
        kpiType: target.kpiType,
        periodMonth: target.periodMonth,
        periodYear: target.periodYear,
        targetValue: target.targetValue,
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
          const txRepo = new KPIAchievementPgRepository(txDb);

          await txRepo.save(target, dto.tenantId);

          await this.outboxRepo.save(conn, {
            eventId: event.eventId,
            tenantId: dto.tenantId,
            type: event.type,
            version: 'v1',
            payload: event.payload,
          }, 'KPIAchievement', target.id);
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
      'kpi_achievement.created',
      `KPI target created for agent ${target.agentId} in period ${target.periodYear}-${target.periodMonth}`,
      { before: null, after: target.toJSON() }
    );

    return target;
  }
}
