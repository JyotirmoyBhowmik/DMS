import { RecommendationAggregate } from '../../domain/entities/recommendation.entity.js';
import { RecommendationRepository } from '../../domain/repositories/recommendation.repository.js';
import { ListRecommendationsQueryDto, RecommendationResponseDto } from '../dtos/recommendation.dto.js';
import { Principal } from './create-recommendation.usecase.js';

export interface PaginatedRecommendationsResponseDto {
  recommendations: RecommendationResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class ListRecommendationsUseCase {
  constructor(private readonly repository: RecommendationRepository) {}

  public async execute(principal: Principal, query: ListRecommendationsQueryDto): Promise<PaginatedRecommendationsResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('recommendation:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to list recommendations.');
    }

    const result = await this.repository.findAll({
      tenantId: principal.tenantId,
      title: query.title,
      targetType: query.targetType,
      targetId: query.targetId,
      recommendationType: query.recommendationType,
      status: query.status,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20
    });

    return {
      recommendations: result.recommendations.map(r => this.mapToResponse(r)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    };
  }

  private mapToResponse(recommendation: RecommendationAggregate): RecommendationResponseDto {
    return {
      id: recommendation.id,
      tenantId: recommendation.tenantId,
      title: recommendation.title,
      targetType: recommendation.targetType,
      targetId: recommendation.targetId,
      recommendationType: recommendation.recommendationType,
      score: recommendation.score,
      status: recommendation.status,
      payload: recommendation.payload,
      version: recommendation.version,
      createdAt: recommendation.createdAt.toISOString(),
      updatedAt: recommendation.updatedAt.toISOString()
    };
  }
}
