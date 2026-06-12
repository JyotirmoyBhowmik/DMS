import { randomUUID } from 'node:crypto';
import { IssueTokenUseCase } from '../../../application/usecases/issue_token.usecase.js';
import { VerifyTokenUseCase } from '../../../application/usecases/verify_token.usecase.js';
import { PostgresDatabaseClient, PgDriver } from '@dms/pkg-database';
import { RefreshTokenPgRepository } from '../../../infrastructure/database/repositories/refresh_token.pg-repository.js';
import { KeyManager } from '../../../application/usecases/key_manager.js';
import { StructuredLogger } from '@dms/pkg-logger';
import { AuditController } from '../../../../../audit-service/src/presentation/rest/controllers/audit.controller.js';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

export interface HttpResponse {
  statusCode: number;
  body: Record<string, unknown>;
}

interface LockoutInfo {
  failedAttempts: number;
  lockedUntil?: number;
}

export class AuthController {
  private db = new PostgresDatabaseClient(config.db, new PgDriver());
  private refreshTokenRepo = new RefreshTokenPgRepository(this.db);
  private issueUseCase = new IssueTokenUseCase(this.refreshTokenRepo);
  private verifyUseCase = new VerifyTokenUseCase();
  private logger = new StructuredLogger('AuthController');

  // Lockout map tracking tenantId:email -> LockoutInfo
  private lockoutMap = new Map<string, LockoutInfo>();
  // Rate limiting map tracking email/IP -> request timestamps
  private rateLimitMap = new Map<string, number[]>();

  private isRateLimited(key: string): boolean {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 10;

    let requests = this.rateLimitMap.get(key) || [];
    requests = requests.filter(t => now - t < windowMs);

    if (requests.length >= maxRequests) {
      return true;
    }

    requests.push(now);
    this.rateLimitMap.set(key, requests);
    return false;
  }

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
    const { email, password, ssoToken, mfaCode } = (requestBody || {}) as Record<string, string>;

    const identifier = email || ssoToken || 'unknown';
    this.logger.info('Login request received', { email: identifier, tenantId, hasSso: !!ssoToken, hasMfa: !!mfaCode });

    // 1. Rate Limiting check
    if (this.isRateLimited(identifier)) {
      this.logger.warn('Login attempt rate limited', { email: identifier, tenantId });
      return {
        statusCode: 429,
        body: {
          message: 'Too many login attempts. Please try again later.',
        },
      };
    }

    if (!email && !ssoToken) {
      return {
        statusCode: 400,
        body: {
          message: 'Email or SSO token is required',
        },
      };
    }

    const lockoutKey = `${tenantId}:${identifier}`;

    // 2. Lockout check
    const lockoutInfo = this.lockoutMap.get(lockoutKey);
    if (lockoutInfo && lockoutInfo.lockedUntil) {
      if (lockoutInfo.lockedUntil > Date.now()) {
        this.logger.warn('Login attempt on locked account', { email: identifier, tenantId });
        return {
          statusCode: 429,
          body: {
            message: 'Account locked out due to multiple failed login attempts. Please try again in 15 minutes.',
          },
        };
      } else {
        // Lockout expired, clean it up
        this.lockoutMap.delete(lockoutKey);
      }
    }

    try {
      const result = await this.issueUseCase.execute(tenantId, email || 'sso-user@dms.enterprise', ['agent'], password, ssoToken, mfaCode);

      // Reset lockout on success
      this.lockoutMap.delete(lockoutKey);

      // Record successful login
      await this.recordAuditLog(email || 'sso-user', tenantId, 'login.success', 'Login successful');

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
      const reason = (err as Error).message;
      this.logger.warn('Login failed', { email: identifier, error: reason });

      // Increment failed attempts
      const currentAttempts = (lockoutInfo?.failedAttempts ?? 0) + 1;
      let lockedUntil: number | undefined;

      if (currentAttempts >= 5) {
        lockedUntil = Date.now() + 15 * 60 * 1000; // 15 mins lockout
        this.lockoutMap.set(lockoutKey, { failedAttempts: currentAttempts, lockedUntil });
        
        // Record lockout event
        await this.recordAuditLog(email || 'unknown', tenantId, 'auth.lockout', `Account locked out for 15 minutes. Reason: ${reason}`);
      } else {
        this.lockoutMap.set(lockoutKey, { failedAttempts: currentAttempts });

        // Record failed login event
        await this.recordAuditLog(email || 'unknown', tenantId, 'login.failure', `Failed login attempt ${currentAttempts}/5. Reason: ${reason}`);
      }

      return {
        statusCode: currentAttempts >= 5 ? 429 : 401,
        body: {
          message: currentAttempts >= 5 
            ? 'Account locked out due to multiple failed login attempts. Please try again in 15 minutes.' 
            : reason,
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

  private async recordAuditLog(
    actor: string,
    tenantId: string,
    type: string,
    result: string
  ): Promise<void> {
    try {
      const auditController = AuditController.getInstance();
      await auditController.handlePostRecordEvent(
        {
          eventId: `evt-${randomUUID()}`,
          type,
          actor,
          tenantId,
          result,
          metadata: {
            timestamp: new Date().toISOString(),
            correlationId: `corr-${randomUUID()}`,
          },
        },
        { 'x-tenant-id': tenantId }
      );
    } catch {
      // Tolerate logging errors
    }
  }
}
