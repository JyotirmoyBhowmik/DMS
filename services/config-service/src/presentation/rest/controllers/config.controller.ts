import { StructuredLogger } from '@dms/pkg-logger';
import { EvaluateFlagUseCase, EvaluationContext } from '../../../application/usecases/evaluate_flag.usecase.js';
import { UpdateFlagUseCase, UpdateFlagRequest } from '../../../application/usecases/update_flag.usecase.js';

export class ConfigController {
  private logger = new StructuredLogger('ConfigController');
  private evaluateUseCase = new EvaluateFlagUseCase();
  private updateUseCase = new UpdateFlagUseCase();

  /**
   * Evaluate a single flag for a tenant.
   */
  async handleGetFlag(
    flagKey: string,
    tenantId: string,
    context: EvaluationContext = {}
  ): Promise<any> {
    this.logger.info('Evaluating single feature flag', { flagKey, tenantId, context });

    const flags = UpdateFlagUseCase.getFlagsForTenant(tenantId);
    const flag = flags[flagKey];

    if (!flag) {
      return {
        statusCode: 404,
        body: { error: `Flag ${flagKey} not found`, code: 'FLAG_NOT_FOUND' },
      };
    }

    const isEnabled = this.evaluateUseCase.execute(flag, context);

    return {
      statusCode: 200,
      body: {
        flagKey,
        isEnabled,
      },
    };
  }

  /**
   * Evaluate all flags for a tenant.
   * Matches `/configs/eval` expected by pkg-config-client.
   */
  async handleEvaluateFlags(
    tenantId: string,
    context: EvaluationContext = {}
  ): Promise<any> {
    this.logger.info('Evaluating all feature flags for tenant', { tenantId, context });

    const flags = UpdateFlagUseCase.getFlagsForTenant(tenantId);
    const evaluated: Record<string, boolean> = {};

    for (const [key, flag] of Object.entries(flags)) {
      evaluated[key] = this.evaluateUseCase.execute(flag, context);
    }

    return {
      statusCode: 200,
      body: {
        flags: evaluated,
      },
    };
  }

  /**
   * Update a feature flag configuration.
   */
  async handleUpdateFlag(
    request: UpdateFlagRequest,
    correlationId: string
  ): Promise<any> {
    this.logger.info('Updating feature flag config via controller', { request, correlationId });

    try {
      const result = await this.updateUseCase.execute(request, { correlationId });
      return {
        statusCode: 200,
        body: {
          success: true,
          flag: result.flag,
          eventRaised: result.event.eventId,
        },
      };
    } catch (err: any) {
      return {
        statusCode: 500,
        body: { error: err.message || 'Internal server error', code: 'UPDATE_FAILED' },
      };
    }
  }
}
