import { randomUUID } from 'node:crypto';
import { ForecastModelAggregate } from '../../domain/entities/forecast_model.entity.js';
import { ForecastModelRepository } from '../../domain/repositories/forecast_model.repository.js';
import { validateCreateForecastModelInput } from '../../domain/validation/forecast_model.validation.js';
import { ForecastAuditService } from '../../infrastructure/audit/forecast.audit.js';
import { CreateForecastModelDto, ForecastModelResponseDto } from '../dtos/forecast_model.dto.js';

export interface Principal {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

export class CreateForecastModelUseCase {
  private static processedKeys: Set<string> = new Set<string>();

  constructor(
    private readonly repository: ForecastModelRepository,
    private readonly auditService: ForecastAuditService = new ForecastAuditService()
  ) {}

  public async execute(principal: Principal, dto: CreateForecastModelDto): Promise<ForecastModelResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('forecast:model:create') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to create forecast model.');
    }

    validateCreateForecastModelInput(dto);

    if (dto.idempotencyKey) {
      const key = `${principal.tenantId}:${dto.idempotencyKey}`;
      if (CreateForecastModelUseCase.processedKeys.has(key)) {
        throw new Error(`Duplicate request: Idempotency key '${dto.idempotencyKey}' already processed.`);
      }
      CreateForecastModelUseCase.processedKeys.add(key);
    }

    const existing = await this.repository.findByName(dto.modelName.trim(), principal.tenantId);
    if (existing) {
      throw new Error(`ForecastModel with name '${dto.modelName.trim()}' already exists for this tenant.`);
    }

    const modelId = dto.id ?? randomUUID();

    const model = ForecastModelAggregate.create({
      id: modelId,
      tenantId: principal.tenantId,
      modelName: dto.modelName.trim(),
      algorithm: dto.algorithm,
      hyperparameters: dto.hyperparameters
    });

    await this.repository.save(model);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'FORECAST_MODEL_CREATED',
      entityId: model.id,
      newValue: { modelName: model.modelName, algorithm: model.algorithm, status: model.status }
    });

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
