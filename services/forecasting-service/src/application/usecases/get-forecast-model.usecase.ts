import { ForecastModelAggregate } from '../../domain/entities/forecast_model.entity.js';
import { ForecastModelRepository } from '../../domain/repositories/forecast_model.repository.js';
import { ForecastModelResponseDto } from '../dtos/forecast_model.dto.js';
import { Principal } from './create-forecast-model.usecase.js';

export class GetForecastModelUseCase {
  constructor(private readonly repository: ForecastModelRepository) {}

  public async execute(principal: Principal, id: string): Promise<ForecastModelResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('forecast:model:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to view forecast model.');
    }
    if (!id || id.trim().length === 0) {
      throw new Error('ForecastModel ID is required.');
    }

    const model = await this.repository.findById(id, principal.tenantId);
    if (!model) {
      throw new Error(`ForecastModel with ID '${id}' not found.`);
    }

    return this.mapToResponse(model);
  }

  public async getByName(principal: Principal, modelName: string): Promise<ForecastModelResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('forecast:model:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to view forecast model.');
    }
    if (!modelName || modelName.trim().length === 0) {
      throw new Error('ForecastModel modelName is required.');
    }

    const model = await this.repository.findByName(modelName.trim(), principal.tenantId);
    if (!model) {
      throw new Error(`ForecastModel with name '${modelName.trim()}' not found.`);
    }

    return this.mapToResponse(model);
  }

  private mapToResponse(model: ForecastModelAggregate): ForecastModelResponseDto {
    return {
      id: model.id,
      tenantId: model.tenantId,
      modelName: model.modelName,
      algorithm: model.algorithm,
      status: model.status,
      accuracyMape: model.accuracyMape,
      accuracyRmse: model.accuracyRmse,
      hyperparameters: model.hyperparameters,
      version: model.version,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString()
    };
  }
}
