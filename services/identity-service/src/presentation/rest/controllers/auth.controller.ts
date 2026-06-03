import { IssueTokenUseCase } from '../../../application/usecases/issue_token.usecase.js';
import { VerifyTokenUseCase } from '../../../application/usecases/verify_token.usecase.js';
import { KeyManager } from '../../../application/usecases/key_manager.js';
import { StructuredLogger } from '@dms/pkg-logger';

export interface HttpResponse {
  statusCode: number;
  body: Record<string, unknown>;
}

export class AuthController {
  private issueUseCase = new IssueTokenUseCase();
  private verifyUseCase = new VerifyTokenUseCase();
  private logger = new StructuredLogger('AuthController');

  async handleGetJwks(): Promise<HttpResponse> {
    this.logger.info('JWKS request received');
    try {
      const jwks = KeyManager.getInstance().getJwks();
      return {
        statusCode: 200,
        body: jwks as unknown as Record<string, unknown>,
      };
    } catch (err: unknown) {
      this.logger.error('Failed to get JWKS', { error: (err as Error).message });
      return {
        statusCode: 500,
        body: {
          message: 'Internal Server Error',
        },
      };
    }
  }

  async handlePostLogin(requestBody: unknown, headers: Record<string, string>): Promise<HttpResponse> {
    const tenantId = headers['x-tenant-id'] || 'mock-tenant';
    const { email, password } = (requestBody || {}) as Record<string, string>;

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
      const result = await this.issueUseCase.execute(tenantId, email, ['agent'], password);
      return {
        statusCode: 200,
        body: {
          success: true,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
        },
      };
    } catch (err: unknown) {
      this.logger.error('Login failed', { error: (err as Error).message });
      return {
        statusCode: 500,
        body: {
          message: 'Internal Server Error',
        },
      };
    }
  }

  async handlePostVerify(requestBody: unknown, _headers: Record<string, string>): Promise<HttpResponse> {
    const { token } = (requestBody || {}) as Record<string, string>;
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
          claims: claims as unknown as Record<string, unknown>,
        },
      };
    } catch (err: unknown) {
      this.logger.warn('Token verification failed', { error: (err as Error).message });
      return {
        statusCode: 401,
        body: {
          valid: false,
          message: (err as Error).message,
        },
      };
    }
  }
}
