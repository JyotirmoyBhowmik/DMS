import { IssueTokenUseCase } from '../../../application/usecases/issue_token.usecase.js';
import { VerifyTokenUseCase } from '../../../application/usecases/verify_token.usecase.js';
import { StructuredLogger } from '@dms/pkg-logger';

export class AuthController {
  private issueUseCase = new IssueTokenUseCase();
  private verifyUseCase = new VerifyTokenUseCase();
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
      const result = await this.issueUseCase.execute(tenantId, email, ['agent']);
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

  async handlePostVerify(requestBody: any, _headers: Record<string, string>): Promise<any> {
    const { token } = requestBody || {};
    this.logger.info('Verify request received');

    if (!token) {
      return {
        statusCode: 400,
        body: {
          message: 'Token is required',
        },
      };
    }

    try {
      const claims = await this.verifyUseCase.execute(token);
      return {
        statusCode: 200,
        body: {
          valid: true,
          claims,
        },
      };
    } catch (err: any) {
      this.logger.warn('Token verification failed', { error: err.message });
      return {
        statusCode: 401,
        body: {
          valid: false,
          message: err.message,
        },
      };
    }
  }
}
