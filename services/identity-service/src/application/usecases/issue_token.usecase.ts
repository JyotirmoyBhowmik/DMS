import { StructuredLogger } from '@dms/pkg-logger';
import { randomUUID } from 'node:crypto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class IssueTokenUseCase {
  private logger = new StructuredLogger('IssueTokenUseCase');

  async execute(tenantId: string, email: string, roles: string[]): Promise<TokenPair> {
    this.logger.info('Issuing token pair for user', { email, tenantId });

    // Mock token pair generation with UUIDs
    const accessToken = 'access-token-mock-' + randomUUID();
    const refreshToken = 'refresh-token-mock-' + randomUUID();

    this.logger.info('Token pair generated successfully', { email });

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600, // 1 hour
    };
  }
}
