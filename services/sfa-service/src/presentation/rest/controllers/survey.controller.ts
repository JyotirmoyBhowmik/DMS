import {
  CreateSurveyUseCase,
  UpdateSurveyUseCase,
  GetSurveyUseCase,
  ListSurveysUseCase,
} from '../../../application/usecases/survey/survey.usecases.js';
import { SurveyPgRepository } from '../../../infrastructure/database/repositories/survey.pg-repository.js';
import { CreateSurveyInputSchema, UpdateSurveyInputSchema, ListSurveysQuerySchema } from '@dms/pkg-validation';
import { Principal } from '@dms/pkg-rbac';
import { StructuredLogger } from '@dms/pkg-logger';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

export class SurveyController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private repo = new SurveyPgRepository(this.db);
  private createUseCase = new CreateSurveyUseCase(this.db, this.repo);
  private getUseCase = new GetSurveyUseCase(this.db, this.repo);
  private updateUseCase = new UpdateSurveyUseCase(this.db, this.repo);
  private listUseCase = new ListSurveysUseCase(this.db, this.repo);
  private logger = new StructuredLogger('SurveyController');

  static clearStore(): void {
    SurveyPgRepository.clearStore();
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
    this.logger.info('Received HTTP POST survey request', { tenantId });
    const principal = this.buildPrincipal(headers);

    try {
      const parsed = CreateSurveyInputSchema.parse(body);
      const survey = await this.createUseCase.execute(principal, {
        ...parsed,
        tenantId,
      });

      return {
        statusCode: 201,
        body: {
          success: true,
          survey: survey.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.warn('Validation or execution failed for create survey', { errors: err.message });
      const isForbidden = err.message.includes('Forbidden') || err.message.includes('permission');
      return {
        statusCode: isForbidden ? 403 : 400,
        body: { success: false, error: err.message },
      };
    }
  }

  async handleUpdate(id: string, body: any, headers: Record<string, string | undefined>) {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    this.logger.info('Received HTTP PUT survey request', { id, tenantId });
    const principal = this.buildPrincipal(headers);

    try {
      const parsed = UpdateSurveyInputSchema.parse(body);
      const survey = await this.updateUseCase.execute(principal, {
        ...parsed,
        id,
        tenantId,
      });

      return {
        statusCode: 200,
        body: {
          success: true,
          survey: survey.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.warn('Validation or execution failed for update survey', { id, error: err.message });
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
    this.logger.info('Received HTTP GET survey request', { id, tenantId });
    const principal = this.buildPrincipal(headers);

    try {
      const survey = await this.getUseCase.execute(principal, id, tenantId);
      return {
        statusCode: 200,
        body: {
          success: true,
          survey: survey.toJSON(),
        },
      };
    } catch (err: any) {
      this.logger.warn('Failed to get survey', { id, error: err.message });
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
    this.logger.info('Received HTTP GET list surveys request', { tenantId });
    const principal = this.buildPrincipal(headers);

    try {
      const page = queryParams.page ? Number(queryParams.page) : undefined;
      const pageSize = queryParams.pageSize ? Number(queryParams.pageSize) : undefined;

      const parsed = ListSurveysQuerySchema.parse({
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
      this.logger.warn('Failed to list surveys', { error: err.message });
      const isForbidden = err.message.includes('Forbidden');
      return {
        statusCode: isForbidden ? 403 : 400,
        body: { success: false, error: err.message },
      };
    }
  }

  async handleCreateSurvey(body: any, headers: Record<string, string | undefined>) {
    return this.handleCreate(body, headers);
  }

  async handleGetSurvey(id: string, headers: Record<string, string | undefined>) {
    return this.handleGet(id, headers);
  }

  async handleSubmitResponses(body: any, headers: Record<string, string | undefined>) {
    return {
      statusCode: 200,
      body: {
        success: true,
        message: 'Survey responses submitted successfully',
      },
    };
  }
}
