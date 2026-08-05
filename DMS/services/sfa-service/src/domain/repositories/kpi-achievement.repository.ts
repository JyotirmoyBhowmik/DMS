import { KPIAchievement } from '../entities/kpi-achievement.js';

export interface KPIAchievementRepository {
  save(achievement: KPIAchievement, tenantId: string): Promise<KPIAchievement>;
  findById(id: string, tenantId: string): Promise<KPIAchievement | null>;
  findByAgentAndPeriod(
    agentId: string,
    periodMonth: number,
    periodYear: number,
    tenantId: string
  ): Promise<KPIAchievement[]>;
  findAll(tenantId: string, limit?: number, offset?: number): Promise<KPIAchievement[]>;
  delete(id: string, tenantId: string): Promise<void>;
  count(tenantId: string): Promise<number>;
}
