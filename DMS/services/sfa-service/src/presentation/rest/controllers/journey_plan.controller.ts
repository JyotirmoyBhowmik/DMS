import { CreateJourneyPlanUseCase } from '../../../application/usecases/journey-plan/create_journey_plan.usecase.js';
import { GetJourneyPlanUseCase } from '../../../application/usecases/journey-plan/get_journey_plan.usecase.js';
import { UpdateJourneyPlanUseCase } from '../../../application/usecases/journey-plan/update_journey_plan.usecase.js';
import { ListJourneyPlansUseCase } from '../../../application/usecases/journey-plan/list_journey_plans.usecase.js';
import { CreateJourneyPlanSchema } from '@dms/pkg-validation';
import { StructuredLogger } from '@dms/pkg-logger';
import { loadConfigSync } from '@dms/pkg-config';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { JourneyPlanRepository } from '../../../infrastructure/database/repositories/journey_plan.repository.js';

const config = loadConfigSync();

export class JourneyPlanController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new JourneyPlanRepository(this.db);
  private createUseCase = new CreateJourneyPlanUseCase(this.db, this.repo);
  private getUseCase = new GetJourneyPlanUseCase(this.db, this.repo);
  private updateUseCase = new UpdateJourneyPlanUseCase(this.db, this.repo);
  private listUseCase = new ListJourneyPlansUseCase(this.db, this.repo);
  private logger = new StructuredLogger('JourneyPlanController');

  static clearStore(): void {
    JourneyPlanRepository.clearStore();
  }

  async handleCreateJourneyPlan(requestBody: any, headers: Record<string, string>): Promise<any> {
    return this.handlePostPlan(requestBody, headers);
  }

  async handleGetAgentJourney(agentId: string, date: string, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP GET journey plan by agent and date request', { agentId, date, tenantId });
    try {
      const plan = await this.repo.findByAgentAndDate(agentId, date, tenantId);
      if (!plan) {
        return {
          statusCode: 404,
          body: {
            success: false,
            message: `Journey plan not found for agent ${agentId} on date ${date}`,
          },
        };
      }
      return {
        statusCode: 200,
        body: {
          success: true,
          plan: plan.toJSON(),
        },
      };
    } catch (err: any) {
      return {
        statusCode: 500,
        body: {
          success: false,
          message: err.message,
        },
      };
    }
  }

  async handlePostPlan(requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    const agentId = headers['x-agent-id'] || 'mock-agent';

    this.logger.info('Received HTTP POST journey plan request', { tenantId, agentId });

    const validationResult = CreateJourneyPlanSchema.safeParse(requestBody);
    if (!validationResult.success) {
      this.logger.warn('Validation failed for create journey plan', { errors: validationResult.error.errors });
      return {
        statusCode: 400,
        body: {
          message: 'Bad Request',
          errors: validationResult.error.errors,
        },
      };
    }

    try {
      const result = await this.createUseCase.execute(tenantId, agentId, validationResult.data);
      return {
        statusCode: 201,
        body: {
          success: true,
          planId: result.planId,
          status: result.status,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to create journey plan', { error: err.message });
      if (err.message.includes('already exists')) {
        return {
          statusCode: 409,
          body: {
            success: false,
            message: err.message,
          },
        };
      }
      return {
        statusCode: 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handlePutPlan(id: string, requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP PUT journey plan request', { id, tenantId });

    try {
      const result = await this.updateUseCase.execute(tenantId, id, requestBody);
      return {
        statusCode: 200,
        body: {
          success: true,
          planId: result.planId,
          status: result.status,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to update journey plan', { error: err.message });
      return {
        statusCode: err.message.includes('not found') ? 404 : 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handleGetPlan(id: string, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP GET journey plan request', { id, tenantId });

    try {
      const plan = await this.getUseCase.execute(tenantId, id);
      return {
        statusCode: 200,
        body: {
          success: true,
          journeyPlan: plan.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to get journey plan', { error: err.message });
      return {
        statusCode: err.message.includes('not found') ? 404 : 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handleListPlans(requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP GET journey plans list request', { tenantId });

    try {
      const result = await this.listUseCase.execute(tenantId, requestBody || {});
      return {
        statusCode: 200,
        body: {
          success: true,
          data: result.data.map(p => p.toJSON()),
          page: result.page,
          pageSize: result.pageSize,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to list journey plans', { error: err.message });
      return {
        statusCode: 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }
}
