import { SurveyRepository } from '../../../domain/repositories/survey.repository.js';
import { Survey, Question, ResponseItem } from '../../../domain/entities/survey.js';

export class CreateSurveyUseCase {
  constructor(private readonly repo: SurveyRepository) {}

  async execute(input: {
    id: string;
    tenantId: string;
    outletId: string;
    agentId: string;
    questions: Question[];
  }): Promise<Survey> {
    const survey = Survey.create({
      id: input.id,
      tenantId: input.tenantId,
      outletId: input.outletId,
      agentId: input.agentId,
      questions: input.questions,
    });
    return this.repo.save(survey, input.tenantId);
  }
}

export class SubmitSurveyResponsesUseCase {
  constructor(private readonly repo: SurveyRepository) {}

  async execute(input: {
    id: string;
    tenantId: string;
    responses: ResponseItem[];
  }): Promise<Survey> {
    const survey = await this.repo.findById(input.id, input.tenantId);
    survey.submitResponses(input.responses);
    return this.repo.update(survey, input.tenantId);
  }
}

export class GetSurveyUseCase {
  constructor(private readonly repo: SurveyRepository) {}

  async execute(id: string, tenantId: string): Promise<Survey> {
    return this.repo.findById(id, tenantId);
  }
}
