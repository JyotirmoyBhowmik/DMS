import { RecommendationTargetType, RecommendationType, RecommendationStatus } from '../../domain/entities/recommendation.entity.js';

export interface CreateRecommendationDto {
  id?: string;
  title: string;
  targetType?: RecommendationTargetType;
  targetId: string;
  recommendationType?: RecommendationType;
  score?: number;
  payload?: Record<string, any>;
  idempotencyKey?: string;
}

export interface UpdateRecommendationDto {
  action?: 'activate' | 'apply' | 'dismiss' | 'expire';
  expectedVersion: number;
}

export interface RecommendationResponseDto {
  id: string;
  tenantId: string;
  title: string;
  targetType: RecommendationTargetType;
  targetId: string;
  recommendationType: RecommendationType;
  score: number;
  status: RecommendationStatus;
  payload: Record<string, any>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListRecommendationsQueryDto {
  title?: string;
  targetType?: RecommendationTargetType;
  targetId?: string;
  recommendationType?: RecommendationType;
  status?: RecommendationStatus;
  page?: number;
  pageSize?: number;
}
