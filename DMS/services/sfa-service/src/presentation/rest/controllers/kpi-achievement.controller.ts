import {
  CreateKPIAchievementUseCase,
  UpdateKPIAchievementUseCase,
  GetKPIAchievementUseCase,
  ListKPIAchievementsUseCase,
} from '../../../application/usecases/kpi-achievement/kpi-achievement.usecases.js';
import { KPIAchievementPgRepository } from '../../../infrastructure/database/repositories/kpi-achievement.pg-repository.js';
import { CreateKPIAchievementSchema, UpdateKPIAchievementSchema, ListKPIAchievementsQuerySchema } from '@dms/pkg-validation';
import { Principal } from '@dms/pkg-rbac';
import { StructuredLogger } from '@dms/pkg-logger';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { loadConfigSync } from '@dms/pkg-config';
import { recordAudit } from '../../../infrastructure/audit/audit-helper.js';

const config = loadConfigSync();

export class KPIAchievementController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new KPIAchievementPgRepository(this.db);
  private createUseCase = new CreateKPIAchievementUseCase(this.db, this.repo);
  private getUseCase = new GetKPIAchievementUseCase(this.db, this.repo);
  private updateUseCase = new UpdateKPIAchievementUseCase(this.db, this.repo);
  private listUseCase = new ListKPIAchievementsUseCase(this.db, this.repo);
  private logger = new StructuredLogger('KPIAchievementController');

  static clearStore(): void {
    KPIAchievementPgRepository.clearStore();
  }

  private buildPrincipal(headers: Record<string, string | undefined>): Principal {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    const roles = headers['x-user-roles'] ? (headers['x-user-roles'] as string).split(',') : ['agent'];
    return {
      id: headers['x-user-id'] || 'mock-user-uuid',
      tenantId,
      roles,
    };
  }

  async handleCreate(body: any, headers: Record<string, string | undefined>) {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    this.logger.info('Received HTTP POST kpi-achievement request', { tenantId });
    const principal = this.buildPrincipal(headers);

    try {
      const parsed = CreateKPIAchievementSchema.parse(body);
      const target = await this.createUseCase.execute(principal, {
        ...parsed,
        tenantId,
      });

      return {
        statusCode: 201,
        body: {
          success: true,
          kpiAchievement: target.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.warn('Validation or execution failed for create kpi-achievement', { errors: err.message });
      const isForbidden = err.message.includes('Forbidden') || err.message.includes('permission');
      return {
        statusCode: isForbidden ? 403 : 400,
        body: { success: false, error: err.message },
      };
    }
  }

  async handleUpdate(id: string, body: any, headers: Record<string, string | undefined>) {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    this.logger.info('Received HTTP PUT kpi-achievement request', { id, tenantId });
    const principal = this.buildPrincipal(headers);

    try {
      const parsed = UpdateKPIAchievementSchema.parse(body);
      const target = await this.updateUseCase.execute(principal, {
        ...parsed,
        id,
        tenantId,
      });

      return {
        statusCode: 200,
        body: {
          success: true,
          kpiAchievement: target.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.warn('Validation or execution failed for update kpi-achievement', { id, error: err.message });
      const isForbidden = err.message.includes('Forbidden') || err.message.includes('permission');
      const isConflict = err.message.includes('locking') || err.message.includes('conflict') || err.message.includes('version');
      const isNotFound = err.message.includes('not found');

      let statusCode = 400;
      if (isForbidden) statusCode = 403;
      else if (isConflict) statusCode = 409;
      else if (isNotFound) statusCode = 404;

      return {
        statusCode,
        body: { success: false, error: err.message },
      };
    }
  }

  async handleGet(id: string, headers: Record<string, string | undefined>) {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    this.logger.info('Received HTTP GET kpi-achievement request', { id, tenantId });
    const principal = this.buildPrincipal(headers);

    try {
      const target = await this.getUseCase.execute(principal, id, tenantId);
      return {
        statusCode: 200,
        body: {
          success: true,
          kpiAchievement: target.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.warn('Failed to get kpi-achievement', { id, error: err.message });
      const isForbidden = err.message.includes('Forbidden');
      const isNotFound = err.message.includes('not found');
      return {
        statusCode: isNotFound ? 404 : (isForbidden ? 403 : 400),
        body: { success: false, error: err.message },
      };
    }
  }

  async handleList(queryParams: any, headers: Record<string, string | undefined>) {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    this.logger.info('Received HTTP GET list kpi-achievements request', { tenantId });
    const principal = this.buildPrincipal(headers);

    try {
      const page = queryParams.page ? Number(queryParams.page) : undefined;
      const pageSize = queryParams.pageSize ? Number(queryParams.pageSize) : undefined;

      const parsed = ListKPIAchievementsQuerySchema.parse({
        ...queryParams,
        page,
        pageSize,
      });

      const result = await this.listUseCase.execute(principal, {
        ...parsed,
        tenantId,
      });

      return {
        statusCode: 200,
        body: {
          success: true,
          items: result.items.map((t) => t.toJSON()),
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
        },
      };
    } catch (err: any) {
      this.logger.warn('Failed to list kpi-achievements', { error: err.message });
      const isForbidden = err.message.includes('Forbidden');
      return {
        statusCode: isForbidden ? 403 : 400,
        body: { success: false, error: err.message },
      };
    }
  }

  // Legacy compatibility methods
  async handleCreateKPI(body: any, headers: Record<string, string | undefined>) {
    return this.handleCreate(body, headers);
  }

  async handleUpdateProgress(body: any, headers: Record<string, string | undefined>) {
    return this.handleUpdate(body.id || '', body, headers);
  }

  async handleGetAgentKPIs(agentId: string, month: number, year: number, headers: Record<string, string | undefined>) {
    const listRes = await this.handleList({ agentId, periodMonth: month, periodYear: year }, headers);
    if (listRes.statusCode === 200) {
      return {
        statusCode: 200,
        body: {
          success: true,
          kpiAchievements: (listRes.body as any).items,
        },
      };
    }
    return listRes;
  }
}
