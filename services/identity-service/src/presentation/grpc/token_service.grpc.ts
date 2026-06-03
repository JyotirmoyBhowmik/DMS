import { IssueTokenUseCase } from '../../application/usecases/issue_token.usecase.js';
import { RefreshTokenUseCase } from '../../application/usecases/refresh_token.usecase.js';
import { VerifyTokenUseCase } from '../../application/usecases/verify_token.usecase.js';
import { StructuredLogger } from '@dms/pkg-logger';

export interface GrpcCall<T> {
  request: T;
}

export interface IssueTokenRequest {
  email: string;
  password?: string;
  deviceId?: string;
}

export interface IssueTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
  deviceId?: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface VerifyTokenRequest {
  accessToken: string;
}

export interface VerifyTokenResponse {
  valid: boolean;
  principalId: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

export class TokenServiceGrpc {
  private issueUseCase = new IssueTokenUseCase();
  private refreshUseCase = new RefreshTokenUseCase();
  private verifyUseCase = new VerifyTokenUseCase();
  private logger = new StructuredLogger('TokenServiceGrpc');

  async issueToken(call: GrpcCall<IssueTokenRequest>): Promise<IssueTokenResponse> {
    const { email, password } = call.request;
    this.logger.info('gRPC IssueToken request received', { email });

    try {
      // Mock tenantId for demo/stub purposes when using gRPC, default to a standard UUID
      const tenantId = '00000000-0000-0000-0000-000000000001';
      const tokenPair = await this.issueUseCase.execute(tenantId, email, ['agent'], password);
      return {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: tokenPair.expiresIn,
        tokenType: 'Bearer',
      };
    } catch (err: any) {
      this.logger.error('gRPC IssueToken failed', { error: err.message });
      throw new Error(`gRPC Internal Error: ${err.message}`);
    }
  }

  async refreshToken(call: GrpcCall<RefreshTokenRequest>): Promise<RefreshTokenResponse> {
    const { refreshToken } = call.request;
    this.logger.info('gRPC RefreshToken request received');

    try {
      const tokenPair = await this.refreshUseCase.execute(refreshToken);
      return {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: tokenPair.expiresIn,
      };
    } catch (err: any) {
      this.logger.error('gRPC RefreshToken failed', { error: err.message });
      throw new Error(`gRPC Unauthenticated: ${err.message}`);
    }
  }

  async verifyToken(call: GrpcCall<VerifyTokenRequest>): Promise<VerifyTokenResponse> {
    const { accessToken } = call.request;
    this.logger.info('gRPC VerifyToken request received');

    try {
      const claims = await this.verifyUseCase.execute(accessToken);
      // Construct a valid response mapping the claims
      return {
        valid: true,
        principalId: claims.sub,
        tenantId: claims.tenantId,
        roles: claims.roles,
        permissions: ['order:create', 'visit:create', 'sync:push'], // Mock default permissions
      };
    } catch (err: any) {
      this.logger.warn('gRPC VerifyToken failed validation', { error: err.message });
      return {
        valid: false,
        principalId: '',
        tenantId: '',
        roles: [],
        permissions: [],
      };
    }
  }
}
