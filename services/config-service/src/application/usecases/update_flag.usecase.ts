import { FeatureFlag } from '../../domain/entities.js';
import { makeEnvelope, CorrelationContext } from '@dms/pkg-events';
import { StructuredLogger } from '@dms/pkg-logger';

export interface UpdateFlagRequest {
  tenantId: string;
  flagKey: string;
  enabled: boolean;
  rolloutPercentage?: number;
  strategy?: 'boolean' | 'percentage' | 'gradual';
}

export class UpdateFlagUseCase {
  private logger = new StructuredLogger('UpdateFlagUseCase');
  // Simple in-memory tenant flags database for config-service
  private static tenantFlags = new Map<string, Record<string, FeatureFlag>>();

  static getFlagsForTenant(tenantId: string): Record<string, FeatureFlag> {
    if (!this.tenantFlags.has(tenantId)) {
      // Seed default configs
      this.tenantFlags.set(tenantId, {
        'enable-ai-recommendations': {
          key: 'enable-ai-recommendations',
          description: 'Enable AI product recommendations in checkout flow',
          strategy: 'boolean',
          enabled: true,
        },
        'strict-offline-integrity': {
          key: 'strict-offline-integrity',
          description: 'Enforce cryptographic SHA-256 chain checks on local DB',
          strategy: 'boolean',
          enabled: false,
        }
      });
    }
    return this.tenantFlags.get(tenantId)!;
  }

  static clearAll(): void {
    this.tenantFlags.clear();
  }

  async execute(
    request: UpdateFlagRequest,
    ctx: { correlationId: string; causationId?: string }
  ): Promise<{ flag: FeatureFlag; event: any }> {
    const { tenantId, flagKey, enabled, rolloutPercentage, strategy } = request;
    this.logger.info('Updating feature flag configuration', { tenantId, flagKey, enabled });

    const flags = UpdateFlagUseCase.getFlagsForTenant(tenantId);
    
    if (!flags[flagKey]) {
      flags[flagKey] = {
        key: flagKey,
        description: 'Dynamically created flag',
        strategy: strategy ?? 'boolean',
        enabled,
        rolloutPercentage,
      };
    } else {
      const existing = flags[flagKey]!;
      existing.enabled = enabled;
      if (rolloutPercentage !== undefined) existing.rolloutPercentage = rolloutPercentage;
      if (strategy !== undefined) existing.strategy = strategy;
    }

    const updatedFlag = flags[flagKey]!;

    // Raise flag.changed.v1 event
    const eventCtx: CorrelationContext = {
      tenantId,
      correlationId: ctx.correlationId,
      causationId: ctx.causationId,
      producer: 'config-service',
      partitionKey: flagKey,
    };

    const event = makeEnvelope(
      'flag.changed',
      'v1',
      {
        flagKey,
        enabled: updatedFlag.enabled,
        strategy: updatedFlag.strategy,
        rolloutPercentage: updatedFlag.rolloutPercentage,
        updatedAt: new Date().toISOString(),
      },
      eventCtx
    );

    this.logger.info('Feature flag updated and cache flushed. raising flag.changed.v1 event.', {
      flagKey,
      eventId: event.eventId,
    });

    return {
      flag: updatedFlag,
      event,
    };
  }
}
