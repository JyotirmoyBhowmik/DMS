import { RecommendationModelAggregate } from '../../domain/entities/recommendation_model.entity.js';
import { RecommendationModelRepository } from '../../domain/repositories/recommendation_model.repository.js';
import { RecommendationModelResponseDto } from '../dtos/recommendation_model.dto.js';
import { Principal } from './create-recommendation.usecase.js';

export class GetRecommendationModelUseCase {
  constructor(private readonly repository: RecommendationModelRepository) {}

  public async execute(principal: Principal, id: string): Promise<RecommendationModelResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('recommendation:model:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to view recommendation model.');
    }
    if (!id || id.trim().length === 0) {
      throw new Error('RecommendationModel ID is required.');
    }

    const model = await this.repository.findById(id, principal.tenantId);
    if (!model) {
      throw new Error(`RecommendationModel with ID '${id}' not found.`);
    }

    return this.mapToResponse(model);
  }

  public async getByName(principal: Principal, modelName: string): Promise<RecommendationModelResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('recommendation:model:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to view recommendation model.');
    }
    if (!modelName || modelName.trim().length === 0) {
      throw new Error('RecommendationModel modelName is required.');
    }

    const model = await this.repository.findByName(modelName.trim(), principal.tenantId);
    if (!model) {
      throw new Error(`RecommendationModel with name '${modelName.trim()}' not found.`);
    }

    return this.mapToResponse(model);
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
