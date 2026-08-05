import { RecommendationModelAggregate, RecommendationModelType, RecommendationModelStatus } from '../entities/recommendation_model.entity.js';

export interface RecommendationModelFilter {
  tenantId: string;
  modelName?: string;
  modelType?: RecommendationModelType;
  status?: RecommendationModelStatus;
  page?: number;
  pageSize?: number;
}

export interface RecommendationModelRepository {
  save(model: RecommendationModelAggregate): Promise<RecommendationModelAggregate>;
  findById(id: string, tenantId: string): Promise<RecommendationModelAggregate | null>;
  findByName(modelName: string, tenantId: string): Promise<RecommendationModelAggregate | null>;
  findAll(filter: RecommendationModelFilter): Promise<{ models: RecommendationModelAggregate[]; total: number; page: number; pageSize: number }>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
