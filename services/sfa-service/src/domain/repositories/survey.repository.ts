import { Survey } from '../entities/survey.js';

export interface SurveyRepository {
  save(survey: Survey, tenantId: string): Promise<Survey>;
  findById(id: string, tenantId: string): Promise<Survey>;
  update(survey: Survey, tenantId: string): Promise<Survey>;
  findByOutlet(outletId: string, tenantId: string): Promise<Survey[]>;
  findByAgent(agentId: string, tenantId: string): Promise<Survey[]>;
}
