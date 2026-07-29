import { RecommendationModelAggregate } from '../../domain/entities/recommendation_model.entity.js';
import { RecommendationModelRepository } from '../../domain/repositories/recommendation_model.repository.js';
import { ListRecommendationModelsQueryDto, RecommendationModelResponseDto } from '../dtos/recommendation_model.dto.js';
import { Principal } from './create-recommendation.usecase.js';

export interface PaginatedRecommendationModelsResponseDto {
  models: RecommendationModelResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class ListRecommendationModelsUseCase {
  constructor(private readonly repository: RecommendationModelRepository) {}

  public async execute(principal: Principal, query: ListRecommendationModelsQueryDto): Promise<PaginatedRecommendationModelsResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('recommendation:model:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to list recommendation models.');
    }

    const result = await this.repository.findAll({
      tenantId: principal.tenantId,
      modelName: query.modelName,
      modelType: query.modelType,
      status: query.status,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20
    });

    return {
      models: result.models.map(m => this.mapToResponse(m)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    };
  }

  private mapToResponse(model: RecommendationModelAggregate): RecommendationModelResponseDto {
    return {
      id: model.id,
      tenantId: model.tenantId,
      modelName: model.modelName,
      modelType: model.modelType,
      precisionAtK: model.precisionAtK,
      recallAtK: model.recallAtK,
      status: model.status,
      hyperparameters: model.hyperparameters,
      version: model.version,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString()
    };
  }
}
