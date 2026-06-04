import { CreateSurveyUseCase, SubmitSurveyResponsesUseCase, GetSurveyUseCase } from '../../../application/usecases/survey/survey.usecases.js';
import { SurveyPgRepository } from '../../../infrastructure/database/repositories/survey.pg-repository.js';
import { PostgresDatabaseClient } from '@dms/pkg-database';
import { StructuredLogger } from '@dms/pkg-logger';

import { RequirePermissions } from '@dms/pkg-rbac';

export class SurveyController {
  private logger = new StructuredLogger('SurveyController');
  
  constructor(
    private readonly createUseCase: CreateSurveyUseCase,
    private readonly submitUseCase: SubmitSurveyResponsesUseCase,
    private readonly getUseCase: GetSurveyUseCase
  ) {}

  @RequirePermissions('survey:create')

  async handleCreateSurvey(body: any, headers: Record<string, string | undefined>) {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    this.logger.info('Create survey', { tenantId, surveyId: body.id });
    try {
      const survey = await this.createUseCase.execute({ ...body, tenantId });
      return { statusCode: 201, body: { success: true, survey: { id: survey.id, questions: survey.questions } } };
    } catch (err: any) {
      return { statusCode: 400, body: { success: false, error: err.message } };
    }
  }

  @RequirePermissions('survey:submit')
  async handleSubmitResponses(body: any, headers: Record<string, string | undefined>) {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    this.logger.info('Submit survey responses', { tenantId, surveyId: body.id });
    try {
      const survey = await this.submitUseCase.execute({ ...body, tenantId });
      return { statusCode: 200, body: { success: true, survey: { id: survey.id, completedAt: survey.completedAt } } };
    } catch (err: any) {
      return { statusCode: 400, body: { success: false, error: err.message } };
    }
  }

  @RequirePermissions('survey:read')
  async handleGetSurvey(id: string, headers: Record<string, string | undefined>) {
    const tenantId = headers['x-tenant-id'] || '00000000-0000-0000-0000-000000000001';
    this.logger.info('Get survey', { tenantId, surveyId: id });
    try {
      const survey = await this.getUseCase.execute(id, tenantId);
      return { statusCode: 200, body: { success: true, survey: { id: survey.id, responses: survey.responses, completedAt: survey.completedAt } } };
    } catch (err: any) {
      return { statusCode: 404, body: { success: false, error: err.message } };
    }
  }
}
