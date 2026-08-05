import { RecommendationAggregate } from '../../domain/entities/recommendation.entity.js';
import { RecommendationRepository } from '../../domain/repositories/recommendation.repository.js';
import { RecommendationResponseDto } from '../dtos/recommendation.dto.js';
import { Principal } from './create-recommendation.usecase.js';

export class GetRecommendationUseCase {
  constructor(private readonly repository: RecommendationRepository) {}

  public async execute(principal: Principal, id: string): Promise<RecommendationResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('recommendation:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to view recommendation.');
    }
    if (!id || id.trim().length === 0) {
      throw new Error('Recommendation ID is required.');
    }

    const recommendation = await this.repository.findById(id, principal.tenantId);
    if (!recommendation) {
      throw new Error(`Recommendation with ID '${id}' not found.`);
    }

    return this.mapToResponse(recommendation);
  }

  public async getByTitle(principal: Principal, title: string): Promise<RecommendationResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('recommendation:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to view recommendation.');
    }
    if (!title || title.trim().length === 0) {
      throw new Error('Recommendation title is required.');
    }

    const recommendation = await this.repository.findByTitle(title.trim(), principal.tenantId);
    if (!recommendation) {
      throw new Error(`Recommendation with title '${title.trim()}' not found.`);
    }

    return this.mapToResponse(recommendation);
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
