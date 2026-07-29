import { FeatureFlagAggregate } from '../../domain/entities/feature_flag.entity.js';
import { FeatureFlagRepository } from '../../domain/repositories/feature_flag.repository.js';
import { FeatureFlagResponseDto } from '../dtos/feature_flag.dto.js';
import { Principal } from './create-config-entry.usecase.js';

export class GetFeatureFlagUseCase {
  constructor(private readonly repository: FeatureFlagRepository) {}

  public async execute(principal: Principal, id: string): Promise<FeatureFlagResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('flag:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to view feature flag.');
    }
    if (!id || id.trim().length === 0) {
      throw new Error('FeatureFlag ID is required.');
    }

    const flag = await this.repository.findById(id, principal.tenantId);
    if (!flag) {
      throw new Error(`FeatureFlag with ID '${id}' not found.`);
    }

    return this.mapToResponse(flag);
  }

  public async getByKey(principal: Principal, flagKey: string): Promise<FeatureFlagResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('flag:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to view feature flag.');
    }
    if (!flagKey || flagKey.trim().length === 0) {
      throw new Error('FeatureFlag flagKey is required.');
    }

    const flag = await this.repository.findByKey(flagKey.trim(), principal.tenantId);
    if (!flag) {
      throw new Error(`FeatureFlag with key '${flagKey.trim()}' not found.`);
    }

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
