import { CreateJourneyPlanUseCase } from '../../../application/usecases/create_journey_plan.usecase.js';
import { GetAgentJourneyUseCase } from '../../../application/usecases/get_agent_journey.usecase.js';
import { JourneyPlanRepository } from '../../../infrastructure/database/repositories/journey_plan.repository.js';
import { CreateJourneyPlanSchema } from '@dms/pkg-validation';
import { StructuredLogger } from '@dms/pkg-logger';

export class JourneyPlanController {
  private createUseCase = new CreateJourneyPlanUseCase();
  private getUseCase = new GetAgentJourneyUseCase();
  private logger = new StructuredLogger('JourneyPlanController');

  // Shares a single static repository across controller instances for mock state
  private static repo = new JourneyPlanRepository();

  static getRepository(): JourneyPlanRepository {
    return this.repo;
  }

  static clearStore() {
    this.repo = new JourneyPlanRepository();
  }

  async handleCreateJourneyPlan(requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    const agentId = headers['x-agent-id'] || 'mock-agent';

    this.logger.info('Received HTTP POST create journey plan request', { tenantId, agentId });

    const validationResult = CreateJourneyPlanSchema.safeParse(requestBody);
    if (!validationResult.success) {
      this.logger.warn('Validation failed for journey plan creation', { errors: validationResult.error.errors });
      return {
        statusCode: 400,
        body: {
          message: 'Bad Request',
          errors: validationResult.error.errors,
        },
      };
    }

    try {
      const result = await this.createUseCase.execute(
        JourneyPlanController.repo,
        tenantId,
        agentId,
        validationResult.data
      );

      return {
        statusCode: 201,
        body: {
          success: true,
          planId: result.planId,
          status: result.status,
        },
      };
    } catch (err: any) {
      this.logger.error('Journey plan creation failed', { error: err.message });
      return {
        statusCode: err.message.includes('already exists') ? 409 : 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }

  async handleGetAgentJourney(agentId: string, date: string, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    this.logger.info('Received HTTP GET agent journey request', { tenantId, agentId, date });

    try {
      const plan = await this.getUseCase.execute(
        JourneyPlanController.repo,
        tenantId,
        agentId,
        date
      );

      if (!plan) {
        return {
          statusCode: 404,
          body: {
            message: `Journey plan not found for agent ${agentId} on ${date}`,
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
      this.logger.error('Querying agent journey plan failed', { error: err.message });
      return {
        statusCode: 500,
        body: {
          message: err.message || 'Internal Server Error',
        },
      };
    }
  }
}
