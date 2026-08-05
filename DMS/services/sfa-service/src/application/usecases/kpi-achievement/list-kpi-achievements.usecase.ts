import { KPIAchievementRepository } from '../../../domain/repositories/kpi-achievement.repository.js';
import { KPIAchievement } from '../../../domain/entities/kpi-achievement.js';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { KPIAchievementPgRepository } from '../../../infrastructure/database/repositories/kpi-achievement.pg-repository.js';

export interface ListKPIAchievementsDTO {
  tenantId: string;
  page?: number;
  pageSize?: number;
  agentId?: string;
  status?: string;
  kpiType?: string;
}

export class ListKPIAchievementsUseCase {
  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: KPIAchievementRepository
  ) {}

  async execute(principal: Principal, dto: ListKPIAchievementsDTO): Promise<{
    items: KPIAchievement[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== dto.tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    if (!RbacGuard.can(principal, 'kpi_achievement:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to list KPI targets');
    }

    const activeRepo = this.repo || new KPIAchievementPgRepository(this.db);

    const page = Math.max(1, dto.page ?? 1);
    const rawPageSize = dto.pageSize ?? 10;
    const pageSize = Math.max(1, Math.min(100, rawPageSize));
    const offset = (page - 1) * pageSize;

    const list = await activeRepo.findAll(dto.tenantId, pageSize, offset);
    const total = await activeRepo.count(dto.tenantId);

    // Apply client filters if running memory fallback
    let items = list;
    const hasFilters = dto.agentId || dto.status || dto.kpiType;
    if (hasFilters && !this.db) {
      items = Array.from((activeRepo as any).constructor.inMemoryDb.values() as KPIAchievement[])
        .filter((t) => {
          if (t.tenantId !== dto.tenantId) return false;
          if (dto.agentId && t.agentId !== dto.agentId) return false;
          if (dto.status && t.status !== dto.status) return false;
          if (dto.kpiType && t.kpiType !== dto.kpiType) return false;
          return true;
        })
        .slice(offset, offset + pageSize);
    }

    return {
      items,
      total,
      page,
      pageSize,
    };
  }
}
