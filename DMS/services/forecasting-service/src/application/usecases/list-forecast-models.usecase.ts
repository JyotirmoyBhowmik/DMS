import { ForecastModelAggregate } from '../../domain/entities/forecast_model.entity.js';
import { ForecastModelRepository } from '../../domain/repositories/forecast_model.repository.js';
import { ListForecastModelsQueryDto, ForecastModelResponseDto } from '../dtos/forecast_model.dto.js';
import { Principal } from './create-forecast-model.usecase.js';

export interface PaginatedForecastModelsResponseDto {
  models: ForecastModelResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class ListForecastModelsUseCase {
  constructor(private readonly repository: ForecastModelRepository) {}

  public async execute(principal: Principal, query: ListForecastModelsQueryDto): Promise<PaginatedForecastModelsResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('forecast:model:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to list forecast models.');
    }

    const result = await this.repository.findAll({
      tenantId: principal.tenantId,
      modelName: query.modelName,
      algorithm: query.algorithm,
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
