import { FeatureFlagAggregate, FlagStrategy, FlagStatus } from '../entities/feature_flag.entity.js';

export interface FeatureFlagFilter {
  tenantId: string;
  flagKey?: string;
  strategy?: FlagStrategy;
  status?: FlagStatus;
  enabled?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'flagKey';
  sortOrder?: 'asc' | 'desc';
}

export interface FeatureFlagRepository {
  save(flag: FeatureFlagAggregate): Promise<FeatureFlagAggregate>;
  findById(id: string, tenantId: string): Promise<FeatureFlagAggregate | null>;
  findByKey(flagKey: string, tenantId: string): Promise<FeatureFlagAggregate | null>;
  findAll(filter: FeatureFlagFilter): Promise<{ flags: FeatureFlagAggregate[]; total: number; page: number; pageSize: number }>;
  delete(id: string, tenantId: string): Promise<boolean>;
}
