import { KPIAchievementRepository } from '../../../domain/repositories/kpi-achievement.repository.js';
import { KPIAchievement } from '../../../domain/entities/kpi-achievement.js';
import { RbacGuard, Principal } from '@dms/pkg-rbac';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { KPIAchievementPgRepository } from '../../../infrastructure/database/repositories/kpi-achievement.pg-repository.js';

export class GetKPIAchievementUseCase {
  constructor(
    private readonly db?: PostgresDatabaseClient,
    private readonly repo?: KPIAchievementRepository
  ) {}

  async execute(principal: Principal, id: string, tenantId: string): Promise<KPIAchievement> {
    if (!principal) {
      throw new Error('Forbidden: Authentication required');
    }
    if (principal.tenantId !== tenantId) {
      throw new Error('Forbidden: Tenant context mismatch');
    }
    if (!RbacGuard.can(principal, 'kpi_achievement:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to view KPI targets');
    }

    const activeRepo = this.repo || new KPIAchievementPgRepository(this.db);
    const target = await activeRepo.findById(id, tenantId);

    if (!target) {
      throw new Error(`KPI target with ID ${id} not found`);
    }

    return target;
  }
}
