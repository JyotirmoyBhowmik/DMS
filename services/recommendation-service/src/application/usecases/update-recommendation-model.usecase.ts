import { RecommendationModelAggregate } from '../../domain/entities/recommendation_model.entity.js';
import { RecommendationModelRepository } from '../../domain/repositories/recommendation_model.repository.js';
import { RecommendationAuditService } from '../../infrastructure/audit/recommendation.audit.js';
import { RecommendationModelResponseDto, UpdateRecommendationModelDto } from '../dtos/recommendation_model.dto.js';
import { Principal } from './create-recommendation.usecase.js';

export class UpdateRecommendationModelUseCase {
  constructor(
    private readonly repository: RecommendationModelRepository,
    private readonly auditService: RecommendationAuditService = new RecommendationAuditService()
  ) {}

  public async execute(principal: Principal, id: string, dto: UpdateRecommendationModelDto): Promise<RecommendationModelResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('recommendation:model:update') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to update recommendation model.');
    }

    const model = await this.repository.findById(id, principal.tenantId);
    if (!model) {
      throw new Error(`RecommendationModel with ID '${id}' not found.`);
    }

    const oldState = { status: model.status, version: model.version };

    if (dto.action === 'train') {
      model.startTraining(dto.expectedVersion);
    } else if (dto.action === 'activate') {
      model.activate(dto.expectedVersion, dto.precisionAtK, dto.recallAtK);
    } else if (dto.action === 'retire') {
      model.retire(dto.expectedVersion);
    }

    await this.repository.save(model);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'RECOMMENDATION_MODEL_UPDATED',
      entityId: model.id,
      oldValue: oldState,
      newValue: { status: model.status, version: model.version }
    });

    return this.mapToResponse(model);
  }

  public async approveRecommendationModel(principal: Principal, id: string, expectedVersion: number): Promise<RecommendationModelResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('recommendation:model:approve') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to approve recommendation model.');
    }

    const model = await this.repository.findById(id, principal.tenantId);
    if (!model) {
      throw new Error(`RecommendationModel with ID '${id}' not found.`);
    }

    const oldStatus = model.status;
    model.approve(expectedVersion);
    await this.repository.save(model);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'RECOMMENDATION_MODEL_APPROVED',
      entityId: model.id,
      oldValue: { status: oldStatus },
      newValue: { status: model.status, version: model.version }
    });

    return this.mapToResponse(model);
  }

  public async deleteRecommendationModel(principal: Principal, id: string): Promise<boolean> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('recommendation:model:delete') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to delete recommendation model.');
    }

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new Error(`RecommendationModel with ID '${id}' not found.`);
    }

    const deleted = await this.repository.delete(id, principal.tenantId);

    if (deleted) {
      await this.auditService.recordMutation({
        tenantId: principal.tenantId,
        actorId: principal.userId,
        action: 'RECOMMENDATION_MODEL_DELETED',
        entityId: id,
        oldValue: { modelName: existing.modelName, status: existing.status }
      });
    }

    return deleted;
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
