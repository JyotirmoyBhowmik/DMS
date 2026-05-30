import { StructuredLogger } from '@dms/pkg-logger';

export class ConfigController {
  private logger = new StructuredLogger('ConfigController');

  async handleGetFlag(flagKey: string, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';

    this.logger.info('Evaluating feature flag', { flagKey, tenantId });

    // Sane defaults for flag evaluations
    const isEnabled = flagKey !== 'experimental-checkout-flow';

    return {
      statusCode: 200,
      body: {
        flagKey,
        isEnabled,
      },
    };
  }
}
