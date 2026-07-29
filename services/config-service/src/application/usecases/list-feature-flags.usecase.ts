import { FeatureFlagAggregate } from '../../domain/entities/feature_flag.entity.js';
import { FeatureFlagRepository } from '../../domain/repositories/feature_flag.repository.js';
import { ListFeatureFlagsQueryDto, FeatureFlagResponseDto } from '../dtos/feature_flag.dto.js';
import { Principal } from './create-config-entry.usecase.js';

export interface PaginatedFeatureFlagsResponseDto {
  flags: FeatureFlagResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}

export class ListFeatureFlagsUseCase {
  constructor(private readonly repository: FeatureFlagRepository) {}

  public async execute(principal: Principal, query: ListFeatureFlagsQueryDto): Promise<PaginatedFeatureFlagsResponseDto> {
    if (!principal || !principal.tenantId) {
      throw new Error('Unauthorized: Tenant context required.');
    }
    if (!principal.permissions.includes('flag:read') && !principal.roles.includes('admin')) {
      throw new Error('Forbidden: Insufficient permissions to list feature flags.');
    }

    const result = await this.repository.findAll({
      tenantId: principal.tenantId,
      flagKey: query.flagKey,
      strategy: query.strategy,
      status: query.status,
      enabled: query.enabled,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20
    });

    return {
      flags: result.flags.map(f => this.mapToResponse(f)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize
    };
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
