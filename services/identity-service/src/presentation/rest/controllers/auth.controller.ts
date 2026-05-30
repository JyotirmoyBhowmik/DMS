import { IssueTokenUseCase } from '../../../application/usecases/issue_token.usecase';
import { StructuredLogger } from '@dms/pkg-logger';

export class AuthController {
  private useCase = new IssueTokenUseCase();
  private logger = new StructuredLogger('AuthController');

  async handlePostLogin(requestBody: any, headers: Record<string, string>): Promise<any> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    const { email, password } = requestBody || {};

    this.logger.info('Login request received', { email, tenantId });

    if (!email || !password) {
      return {
        statusCode: 400,
        body: {
          message: 'Email and password are required',
        },
      };
    }

    try {
      // Mock login validation
      const result = await this.useCase.execute(tenantId, email, ['agent']);
      return {
        statusCode: 200,
        body: {
          success: true,
          ...result,
        },
      };
    } catch (err: any) {
      this.logger.error('Login failed', { error: err.message });
      return {
        statusCode: 500,
        body: {
          message: 'Internal Server Error',
        },
      };
    }
  }
}
