import { FeatureFlagAggregate } from '../../domain/entities/feature_flag.entity.js';
import { FeatureFlagRepository } from '../../domain/repositories/feature_flag.repository.js';
import { ConfigAuditService } from '../../infrastructure/audit/config.audit.js';
import { FeatureFlagResponseDto, UpdateFeatureFlagDto } from '../dtos/feature_flag.dto.js';
import { Principal } from './create-config-entry.usecase.js';

export class UpdateFeatureFlagUseCase {
  constructor(
    private readonly repository: FeatureFlagRepository,
    private readonly auditService: ConfigAuditService = new ConfigAuditService()
  ) {}

  public async execute(principal: Principal, id: string, dto: UpdateFeatureFlagDto): Promise<FeatureFlagResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('flag:update') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to update feature flag.');
    }

    const flag = await this.repository.findById(id, principal.tenantId);
    if (!flag) {
      throw new Error(`FeatureFlag with ID '${id}' not found.`);
    }

    const oldState = { enabled: flag.enabled, strategy: flag.strategy, status: flag.status, version: flag.version };

    if (dto.enabled !== undefined) {
      flag.toggle(dto.enabled, dto.expectedVersion);
    } else if (dto.strategy) {
      flag.updateStrategy(
        dto.strategy,
        dto.rolloutPercentage ?? flag.rolloutPercentage,
        dto.targetRules ?? flag.targetRules,
        dto.expectedVersion
      );
    } else if (dto.status) {
      if (dto.status === 'ACTIVE') {
        flag.activate(dto.expectedVersion);
      } else if (dto.status === 'INACTIVE') {
        flag.deactivate(dto.expectedVersion);
      } else if (dto.status === 'ARCHIVED') {
        flag.archive(dto.expectedVersion);
      }
    }

    await this.repository.save(flag);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'FEATURE_FLAG_UPDATED',
      entityId: flag.id,
      oldValue: oldState,
      newValue: { enabled: flag.enabled, strategy: flag.strategy, status: flag.status, version: flag.version }
    });

    return this.mapToResponse(flag);
  }

  public async approveFlag(principal: Principal, id: string, expectedVersion: number): Promise<FeatureFlagResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('flag:approve') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to approve feature flag.');
    }

    const flag = await this.repository.findById(id, principal.tenantId);
    if (!flag) {
      throw new Error(`FeatureFlag with ID '${id}' not found.`);
    }

    const oldStatus = flag.status;
    flag.approve(expectedVersion);
    await this.repository.save(flag);

    await this.auditService.recordMutation({
      tenantId: principal.tenantId,
      actorId: principal.userId,
      action: 'FEATURE_FLAG_APPROVED',
      entityId: flag.id,
      oldValue: { status: oldStatus },
      newValue: { status: flag.status, version: flag.version }
    });

    return this.mapToResponse(flag);
  }

  public async deleteFlag(principal: Principal, id: string): Promise<boolean> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('flag:delete') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to delete feature flag.');
    }

    const existing = await this.repository.findById(id, principal.tenantId);
    if (!existing) {
      throw new Error(`FeatureFlag with ID '${id}' not found.`);
    }

    const deleted = await this.repository.delete(id, principal.tenantId);

    if (deleted) {
      await this.auditService.recordMutation({
        tenantId: principal.tenantId,
        actorId: principal.userId,
        action: 'FEATURE_FLAG_DELETED',
        entityId: id,
        oldValue: { flagKey: existing.flagKey, status: existing.status }
      });
    }

    return deleted;
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
