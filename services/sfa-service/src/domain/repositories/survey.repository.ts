import { Survey } from '../entities/survey.js';

export interface SurveyRepository {
  save(survey: Survey, tenantId: string): Promise<void>;
  findById(id: string, tenantId: string): Promise<Survey | null>;
  findByTitle(title: string, tenantId: string): Promise<Survey | null>;
  list(options: {
    tenantId: string;
    agentId?: string;
    outletId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: Survey[]; total: number; page: number; pageSize: number }>;
  delete(id: string, tenantId: string): Promise<void>;
}
