import { KPIAchievementRepository } from '../../../domain/repositories/kpi-achievement.repository.js';
import { KPIAchievement, KPIAchievementStatus } from '../../../domain/entities/kpi-achievement.js';
import { makeEnvelope, OutboxRepository } from '@dms/pkg-events';
import { getCorrelation } from '@dms/pkg-logger';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { TransactionalDbClient } from '../../../infrastructure/database/transactional-client.js';
import { KPIAchievementPgRepository } from '../../../infrastructure/database/repositories/kpi-achievement.pg-repository.js';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';

export interface UpdateKPIAchievementDTO {
  id: string;
  tenantId: string;
  targetValue?: number;
  status?: KPIAchievementStatus;
  achievedValue?: number;
  version: number;
}

export class UpdateKPIAchievementUseCase {
  private outboxRepo = new OutboxRepository({ tableName: 'sfa_outbox' });

  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: KPIAchievementRepository
  ) {}

  async execute(principal: Principal, dto: UpdateKPIAchievementDTO): Promise<KPIAchievement> {
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== dto.tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }

    const activeRepo = this.repo || new KPIAchievementPgRepository(this.db);
    const target = await activeRepo.findById(dto.id, dto.tenantId);

    if (!target || target.tenantId !== dto.tenantId) {
      throw new Error(`KPI target with ID ${dto.id} not found`);
    }

    if (target.version !== dto.version) {
      throw new Error(`Optimistic locking conflict: version mismatch. DB version ${target.version}, requested version ${dto.version}`);
    }

    const originalState = target.toJSON();

    // Check RBAC: only Admin/Distributor can change target values or statuses
    if (dto.targetValue !== undefined || dto.status !== undefined || dto.achievedValue !== undefined) {
      if (!RbacGuard.can(principal, 'kpi_achievement:update') && !principal.roles.includes('admin')) {
        throw new Error('Forbidden: Insufficient permissions to update KPI target');
      }
    }

    // Apply mutations based on domain rules
    if (dto.targetValue !== undefined) {
      target.updateTargetValue(dto.targetValue);
    }

    if (dto.achievedValue !== undefined) {
      target.updateProgress(dto.achievedValue);
    }

    // Status transitions
    if (dto.status === 'SUBMITTED') {
      target.submit();
    } else if (dto.status === 'APPROVED') {
      target.approve();
    } else if (dto.status === 'REJECTED') {
      target.reject();
    }

    const activeCtx = getCorrelation();
    const event = makeEnvelope(
      'sfa.kpi_achievement.updated',
      'v1',
      {
        id: target.id,
        tenantId: target.tenantId,
        agentId: target.agentId,
        status: target.status,
        achievedValue: target.achievedValue,
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

    target.incrementVersion();

    await recordAudit(
      principal.id,
      dto.tenantId,
      'kpi_achievement.updated',
      `KPI target updated to status ${target.status} with progress value ${target.achievedValue}`,
      { before: originalState, after: target.toJSON() }
    );

    return target;
  }
}
