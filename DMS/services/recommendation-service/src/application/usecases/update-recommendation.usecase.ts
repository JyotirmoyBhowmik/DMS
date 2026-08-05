import { RecommendationAggregate } from '../../domain/entities/recommendation.entity.js';
import { RecommendationRepository } from '../../domain/repositories/recommendation.repository.js';
import { RecommendationAuditService } from '../../infrastructure/audit/recommendation.audit.js';
import { RecommendationResponseDto, UpdateRecommendationDto } from '../dtos/recommendation.dto.js';
import { Principal } from './create-recommendation.usecase.js';

export class UpdateRecommendationUseCase {
  constructor(
    private readonly repository: RecommendationRepository,
    private readonly auditService: RecommendationAuditService = new RecommendationAuditService()
  ) {}

  public async execute(principal: Principal, id: string, dto: UpdateRecommendationDto): Promise<RecommendationResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('recommendation:update') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to update recommendation.');
    }

    const recommendation = await this.repository.findById(id, principal.tenantId);
    if (!recommendation) {
      throw new Error(`Recommendation with ID '${id}' not found.`);
    }

    const oldState = { status: recommendation.status, version: recommendation.version };

    if (dto.action === 'activate') {
      recommendation.activate(dto.expectedVersion);
    } else if (dto.action === 'apply') {
      recommendation.apply(dto.expectedVersion);
    } else if (dto.action === 'dismiss') {
      recommendation.dismiss(dto.expectedVersion);
    } else if (dto.action === 'expire') {
      recommendation.expire(dto.expectedVersion);
    }

    await this.repository.save(recommendation);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'RECOMMENDATION_UPDATED',
      entityId: recommendation.id,
      oldValue: oldState,
      newValue: { status: recommendation.status, version: recommendation.version }
    });

    return this.mapToResponse(recommendation);
  }

  public async approveRecommendation(principal: Principal, id: string, expectedVersion: number): Promise<RecommendationResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('recommendation:approve') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to approve recommendation.');
    }

    const recommendation = await this.repository.findById(id, principal.tenantId);
    if (!recommendation) {
      throw new Error(`Recommendation with ID '${id}' not found.`);
    }

    const oldStatus = recommendation.status;
    recommendation.approve(expectedVersion);
    await this.repository.save(recommendation);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'RECOMMENDATION_APPROVED',
      entityId: recommendation.id,
      oldValue: { status: oldStatus },
      newValue: { status: recommendation.status, version: recommendation.version }
    });

    return this.mapToResponse(recommendation);
  }

  public async deleteRecommendation(principal: Principal, id: string): Promise<boolean> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('recommendation:delete') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to delete recommendation.');
    }

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new Error(`Recommendation with ID '${id}' not found.`);
    }

    const deleted = await this.repository.delete(id, principal.tenantId);

    if (deleted) {
      await this.auditService.recordMutation({
        tenantId: principal.tenantId,
        actorId: principal.userId,
        action: 'RECOMMENDATION_DELETED',
        entityId: id,
        oldValue: { title: existing.title, status: existing.status }
      });
    }

    return deleted;
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
