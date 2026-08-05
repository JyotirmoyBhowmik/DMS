import { FlagStrategy, FlagStatus, TargetRule } from '../../domain/entities/feature_flag.entity.js';

export interface CreateFeatureFlagDto {
  id?: string;
  flagKey: string;
  description?: string;
  strategy?: FlagStrategy;
  enabled?: boolean;
  rolloutPercentage?: number;
  targetRules?: TargetRule[];
  status?: FlagStatus;
  idempotencyKey?: string;
}

export interface UpdateFeatureFlagDto {
  enabled?: boolean;
  strategy?: FlagStrategy;
  rolloutPercentage?: number;
  targetRules?: TargetRule[];
  status?: FlagStatus;
  expectedVersion: number;
}

export interface FeatureFlagResponseDto {
  id: string;
  tenantId: string;
  flagKey: string;
  description: string;
  strategy: FlagStrategy;
  enabled: boolean;
  rolloutPercentage: number;
  targetRules: TargetRule[];
  status: FlagStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListFeatureFlagsQueryDto {
  flagKey?: string;
  strategy?: FlagStrategy;
  status?: FlagStatus;
  enabled?: boolean;
  page?: number;
  pageSize?: number;
}
