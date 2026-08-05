import { randomUUID } from 'node:crypto';
import { RecommendationModelAggregate } from '../../domain/entities/recommendation_model.entity.js';
import { RecommendationModelRepository } from '../../domain/repositories/recommendation_model.repository.js';
import { validateCreateRecommendationModelInput } from '../../domain/validation/recommendation_model.validation.js';
import { RecommendationAuditService } from '../../infrastructure/audit/recommendation.audit.js';
import { CreateRecommendationModelDto, RecommendationModelResponseDto } from '../dtos/recommendation_model.dto.js';
import { Principal } from './create-recommendation.usecase.js';

export class CreateRecommendationModelUseCase {
  private static processedKeys: Set<string> = new Set<string>();

  constructor(
    private readonly repository: RecommendationModelRepository,
    private readonly auditService: RecommendationAuditService = new RecommendationAuditService()
  ) {}

  public async execute(principal: Principal, dto: CreateRecommendationModelDto): Promise<RecommendationModelResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('recommendation:model:create') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to create recommendation model.');
    }

    validateCreateRecommendationModelInput(dto);

    if (dto.idempotencyKey) {
      const key = `${principal.tenantId}:${dto.idempotencyKey}`;
      if (CreateRecommendationModelUseCase.processedKeys.has(key)) {
        throw new Error(`Duplicate request: Idempotency key '${dto.idempotencyKey}' already processed.`);
      }
      CreateRecommendationModelUseCase.processedKeys.add(key);
    }

    const existing = await this.repository.findByName(dto.modelName.trim(), principal.tenantId);
    if (existing) {
      throw new Error(`RecommendationModel with name '${dto.modelName.trim()}' already exists for this tenant.`);
    }

    const modelId = dto.id ?? randomUUID();

    const model = RecommendationModelAggregate.create({
      id: modelId,
      tenantId: principal.tenantId,
      modelName: dto.modelName.trim(),
      modelType: dto.modelType,
      hyperparameters: dto.hyperparameters
    });

    await this.repository.save(model);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'RECOMMENDATION_MODEL_CREATED',
      entityId: model.id,
      newValue: { modelName: model.modelName, modelType: model.modelType, status: model.status }
    });

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
