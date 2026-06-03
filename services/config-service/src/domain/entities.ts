export type RolloutStrategy = 'boolean' | 'percentage' | 'gradual';

export interface FeatureFlag {
  key: string;
  description: string;
  strategy: RolloutStrategy;
  enabled: boolean;
  rolloutPercentage?: number; // Used for percentage/gradual rollouts (0 to 100)
  targetRules?: Array<{
    attribute: string; // e.g. 'region', 'role'
    operator: 'in' | 'eq';
    values: string[];
  }>;
}

export interface TenantConfig {
  tenantId: string;
  flags: Record<string, FeatureFlag>;
  updatedAt: string;
}
