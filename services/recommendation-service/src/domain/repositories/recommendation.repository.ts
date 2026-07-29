import { RecommendationAggregate, RecommendationTargetType, RecommendationType, RecommendationStatus } from '../entities/recommendation.entity.js';

export interface RecommendationFilter {
  tenantId: string;
  title?: string;
  targetType?: RecommendationTargetType;
  targetId?: string;
  recommendationType?: RecommendationType;
  status?: RecommendationStatus;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'title' | 'score';
  sortOrder?: 'asc' | 'desc';
}

export interface RecommendationRepository {
  save(recommendation: RecommendationAggregate): Promise<RecommendationAggregate>;
  findById(id: string, tenantId: string): Promise<RecommendationAggregate | null>;
  findByTitle(title: string, tenantId: string): Promise<RecommendationAggregate | null>;
  findAll(filter: RecommendationFilter): Promise<{ recommendations: RecommendationAggregate[]; total: number; page: number; pageSize: number }>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
