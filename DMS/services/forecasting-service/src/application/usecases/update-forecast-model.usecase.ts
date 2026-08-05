import { ForecastModelAggregate } from '../../domain/entities/forecast_model.entity.js';
import { ForecastModelRepository } from '../../domain/repositories/forecast_model.repository.js';
import { ForecastAuditService } from '../../infrastructure/audit/forecast.audit.js';
import { ForecastModelResponseDto, UpdateForecastModelDto } from '../dtos/forecast_model.dto.js';
import { Principal } from './create-forecast-model.usecase.js';

export class UpdateForecastModelUseCase {
  constructor(
    private readonly repository: ForecastModelRepository,
    private readonly auditService: ForecastAuditService = new ForecastAuditService()
  ) {}

  public async execute(principal: Principal, id: string, dto: UpdateForecastModelDto): Promise<ForecastModelResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('forecast:model:update') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to update forecast model.');
    }

    const model = await this.repository.findById(id, principal.tenantId);
    if (!model) {
      throw new Error(`ForecastModel with ID '${id}' not found.`);
    }

    const oldState = { status: model.status, accuracyMape: model.accuracyMape, version: model.version };

    if (dto.action === 'train') {
      model.startTraining(dto.expectedVersion);
    } else if (dto.action === 'activate') {
      const mape = dto.accuracyMape ?? 5.0;
      const rmse = dto.accuracyRmse ?? 10.0;
      model.activate(mape, rmse, dto.expectedVersion);
    } else if (dto.action === 'retire') {
      model.retire(dto.expectedVersion);
    }

    await this.repository.save(model);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'FORECAST_MODEL_UPDATED',
      entityId: model.id,
      oldValue: oldState,
      newValue: { status: model.status, accuracyMape: model.accuracyMape, version: model.version }
    });

    return this.mapToResponse(model);
  }

  public async approveModel(principal: Principal, id: string, expectedVersion: number): Promise<ForecastModelResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('forecast:model:approve') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to approve forecast model.');
    }

    const model = await this.repository.findById(id, principal.tenantId);
    if (!model) {
      throw new Error(`ForecastModel with ID '${id}' not found.`);
    }

    const oldStatus = model.status;
    model.approve(expectedVersion);
    await this.repository.save(model);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'FORECAST_MODEL_APPROVED',
      entityId: model.id,
      oldValue: { status: oldStatus },
      newValue: { status: model.status, version: model.version }
    });

    return this.mapToResponse(model);
  }

  public async deleteModel(principal: Principal, id: string): Promise<boolean> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('forecast:model:delete') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to delete forecast model.');
    }

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new Error(`ForecastModel with ID '${id}' not found.`);
    }

    const deleted = await this.repository.delete(id, principal.tenantId);

    if (deleted) {
      await this.auditService.recordMutation({
        tenantId: principal.tenantId,
        actorId: principal.userId,
        action: 'FORECAST_MODEL_DELETED',
        entityId: id,
        oldValue: { modelName: existing.modelName, status: existing.status }
      });
    }

    return deleted;
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
