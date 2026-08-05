import { RecommendationModelType, RecommendationModelStatus } from '../../domain/entities/recommendation_model.entity.js';

export interface CreateRecommendationModelDto {
  id?: string;
  modelName: string;
  modelType?: RecommendationModelType;
  hyperparameters?: Record<string, any>;
  idempotencyKey?: string;
}

export interface UpdateRecommendationModelDto {
  action?: 'train' | 'activate' | 'retire';
  precisionAtK?: number;
  recallAtK?: number;
  expectedVersion: number;
}

export interface RecommendationModelResponseDto {
  id: string;
  tenantId: string;
  modelName: string;
  modelType: RecommendationModelType;
  precisionAtK?: number;
  recallAtK?: number;
  status: RecommendationModelStatus;
  hyperparameters: Record<string, any>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListRecommendationModelsQueryDto {
  modelName?: string;
  modelType?: RecommendationModelType;
  status?: RecommendationModelStatus;
  page?: number;
  pageSize?: number;
}
