import { randomUUID } from 'node:crypto';
import { FeatureFlagAggregate } from '../../domain/entities/feature_flag.entity.js';
import { FeatureFlagRepository } from '../../domain/repositories/feature_flag.repository.js';
import { validateCreateFeatureFlagInput } from '../../domain/validation/feature_flag.validation.js';
import { ConfigAuditService } from '../../infrastructure/audit/config.audit.js';
import { CreateFeatureFlagDto, FeatureFlagResponseDto } from '../dtos/feature_flag.dto.js';
import { Principal } from './create-config-entry.usecase.js';

export class CreateFeatureFlagUseCase {
  private static processedKeys: Set<string> = new Set<string>();

  constructor(
    private readonly repository: FeatureFlagRepository,
    private readonly auditService: ConfigAuditService = new ConfigAuditService()
  ) {}

  public async execute(principal: Principal, dto: CreateFeatureFlagDto): Promise<FeatureFlagResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('flag:create') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to create feature flag.');
    }

    validateCreateFeatureFlagInput(dto);

    if (dto.idempotencyKey) {
      const key = `${principal.tenantId}:${dto.idempotencyKey}`;
      if (CreateFeatureFlagUseCase.processedKeys.has(key)) {
        throw new Error(`Duplicate request: Idempotency key '${dto.idempotencyKey}' already processed.`);
      }
      CreateFeatureFlagUseCase.processedKeys.add(key);
    }

    const existingKey = await this.repository.findByKey(dto.flagKey.trim(), principal.tenantId);
    if (existingKey) {
      throw new Error(`FeatureFlag with key '${dto.flagKey.trim()}' already exists for this tenant.`);
    }

    const flagId = dto.id ?? randomUUID();

    const flag = FeatureFlagAggregate.create({
      id: flagId,
      tenantId: principal.tenantId,
      flagKey: dto.flagKey.trim(),
      description: dto.description,
      strategy: dto.strategy,
      enabled: dto.enabled,
      rolloutPercentage: dto.rolloutPercentage,
      targetRules: dto.targetRules,
      status: dto.status
    });

    await this.repository.save(flag);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'FEATURE_FLAG_CREATED',
      entityId: flag.id,
      newValue: { flagKey: flag.flagKey, strategy: flag.strategy, enabled: flag.enabled }
    });

    return this.mapToResponse(flag);
  }

  private mapToResponse(flag: FeatureFlagAggregate): FeatureFlagResponseDto {
    return {
      id: flag.id,
      tenantId: flag.tenantId,
      flagKey: flag.flagKey,
      description: flag.description,
      strategy: flag.strategy,
      enabled: flag.enabled,
      rolloutPercentage: flag.rolloutPercentage,
      targetRules: flag.targetRules,
      status: flag.status,
      version: flag.version,
      createdAt: flag.createdAt.toISOString(),
      updatedAt: flag.updatedAt.toISOString()
    };
  }
}
