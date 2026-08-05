import { randomUUID } from 'node:crypto';
import { RecommendationAggregate } from '../../domain/entities/recommendation.entity.js';
import { RecommendationRepository } from '../../domain/repositories/recommendation.repository.js';
import { validateCreateRecommendationInput } from '../../domain/validation/recommendation.validation.js';
import { RecommendationAuditService } from '../../infrastructure/audit/recommendation.audit.js';
import { CreateRecommendationDto, RecommendationResponseDto } from '../dtos/recommendation.dto.js';

export interface Principal {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

export class CreateRecommendationUseCase {
  private static processedKeys: Set<string> = new Set<string>();

  constructor(
    private readonly repository: RecommendationRepository,
    private readonly auditService: RecommendationAuditService = new RecommendationAuditService()
  ) {}

  public async execute(principal: Principal, dto: CreateRecommendationDto): Promise<RecommendationResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('recommendation:create') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to create recommendation.');
    }

    validateCreateRecommendationInput(dto);

    if (dto.idempotencyKey) {
      const key = `${principal.tenantId}:${dto.idempotencyKey}`;
      if (CreateRecommendationUseCase.processedKeys.has(key)) {
        throw new Error(`Duplicate request: Idempotency key '${dto.idempotencyKey}' already processed.`);
      }
      CreateRecommendationUseCase.processedKeys.add(key);
    }

    const existing = await this.repository.findByTitle(dto.title.trim(), principal.tenantId);
    if (existing) {
      throw new Error(`Recommendation with title '${dto.title.trim()}' already exists for this tenant.`);
    }

    const recId = dto.id ?? randomUUID();

    const recommendation = RecommendationAggregate.create({
      id: recId,
      tenantId: principal.tenantId,
      title: dto.title.trim(),
      targetType: dto.targetType,
      targetId: dto.targetId,
      recommendationType: dto.recommendationType,
      score: dto.score,
      payload: dto.payload
    });

    await this.repository.save(recommendation);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'RECOMMENDATION_CREATED',
      entityId: recommendation.id,
      newValue: { title: recommendation.title, targetType: recommendation.targetType, status: recommendation.status }
    });

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
