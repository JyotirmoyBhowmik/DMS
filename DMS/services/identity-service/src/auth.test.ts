process.env.PGUSER = process.env.PGUSER || 'user';
process.env.PGPASSWORD = process.env.PGPASSWORD || 'password';
process.env.PGDATABASE = process.env.PGDATABASE || 'dms';
process.env.PGHOST = process.env.PGHOST || 'localhost';
process.env.PGPORT = process.env.PGPORT || '5432';

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { IssueTokenUseCase } from './application/usecases/issue_token.usecase.js';
import { VerifyTokenUseCase } from './application/usecases/verify_token.usecase.js';
import { RefreshTokenUseCase } from './application/usecases/refresh_token.usecase.js';
import { AssignRoleUseCase } from './application/usecases/assign_role.usecase.js';
import { TokenServiceGrpc } from './presentation/grpc/token_service.grpc.js';
import { AuthController } from './presentation/rest/controllers/auth.controller.js';
import { PostgresDatabaseClient, InMemoryDriver } from '@dms/pkg-database';
import { RefreshTokenPgRepository } from './infrastructure/database/repositories/refresh_token.pg-repository.js';

const db = new PostgresDatabaseClient(new InMemoryDriver());
const refreshTokenRepo = new RefreshTokenPgRepository(db);

void describe('Identity & Auth Verification Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const email = 'agent@enterprise-dms.com';
  const roles = ['agent'];

  void test('IssueTokenUseCase should generate standard RS256 JWT and refresh token', async () => {
    const issueUsecase = new IssueTokenUseCase(refreshTokenRepo);
    const tokenPair = await issueUsecase.execute(tenantId, email, roles);

    assert.ok(tokenPair.accessToken);
    assert.ok(tokenPair.refreshToken);
    assert.strictEqual(tokenPair.expiresIn, 3600);

    // Verify it is structured as header.payload.signature
    const parts = tokenPair.accessToken.split('.');
    assert.strictEqual(parts.length, 3);
  });

  void test('IssueTokenUseCase should verify credentials using scrypt', async () => {
    const issueUsecase = new IssueTokenUseCase(refreshTokenRepo);
    
    // Correct login
    const pair = await issueUsecase.execute(tenantId, email, roles, 'secure_pass_123');
    assert.ok(pair.accessToken);

    // Incorrect login
    await assert.rejects(
      async () => {
        await issueUsecase.execute(tenantId, email, roles, 'wrong_password');
      },
      (err: unknown) => (err as Error).message === 'Invalid credentials'
    );
  });

  void test('VerifyTokenUseCase should decode and validate signed RS256 JWT claims', async () => {
    const issueUsecase = new IssueTokenUseCase(refreshTokenRepo);
    const verifyUsecase = new VerifyTokenUseCase();

    const tokenPair = await issueUsecase.execute(tenantId, email, roles);
    const claims = await verifyUsecase.execute(tokenPair.accessToken);

    assert.strictEqual(claims.sub, email);
    assert.strictEqual(claims.email, email);
    assert.strictEqual(claims.tenantId, tenantId);
    assert.deepStrictEqual(claims.roles, roles);
    assert.ok(claims.exp > claims.iat);
  });

  void test('VerifyTokenUseCase should fail for tampered signatures', async () => {
    const issueUsecase = new IssueTokenUseCase(refreshTokenRepo);
    const verifyUsecase = new VerifyTokenUseCase();

    const tokenPair = await issueUsecase.execute(tenantId, email, roles);
    
    // Tamper the token payload
    const parts = tokenPair.accessToken.split('.');
    const header = parts[0];
    const originalPayload = Buffer.from(parts[1]!, 'base64url').toString('utf8');
    const tamperedPayloadObj = JSON.parse(originalPayload);
    tamperedPayloadObj.roles = ['admin']; // Escalating privilege
    
    const tamperedPayloadB64 = Buffer.from(JSON.stringify(tamperedPayloadObj)).toString('base64url');
    const tamperedToken = `${header}.${tamperedPayloadB64}.${parts[2]}`;

    await assert.rejects(
      async () => {
        await verifyUsecase.execute(tamperedToken);
      },
      (err: unknown) => {
        return (err as Error).message === 'Invalid JWT signature';
      }
    );
  });

  void test('RefreshTokenUseCase should support rotation and reuse detection (revocation)', async () => {
    const issueUsecase = new IssueTokenUseCase(refreshTokenRepo);
    const refreshUsecase = new RefreshTokenUseCase(refreshTokenRepo);

    const pair1 = await issueUsecase.execute(tenantId, email, roles);
    const rt1 = pair1.refreshToken;

    // First rotation (valid)
    const pair2 = await refreshUsecase.execute(rt1, tenantId);
    const rt2 = pair2.refreshToken;
    assert.ok(rt2);
    assert.notStrictEqual(rt1, rt2);

    // Reuse rotation (invalid, must throw and revoke)
    await assert.rejects(
      async () => {
        await refreshUsecase.execute(rt1, tenantId); // Reusing rt1
      },
      (err: unknown) => (err as Error).message.includes('reuse detected')
    );

    // Verify rt2 was revoked due to family revocation
    await assert.rejects(
      async () => {
        await refreshUsecase.execute(rt2, tenantId);
      },
      (err: unknown) => (err as Error).message === 'Invalid refresh token'
    );
  });

  void test('AssignRoleUseCase should raise role.assigned.v1 event', async () => {
    const assignUseCase = new AssignRoleUseCase();
    const correlationId = 'corr-uuid-1111';
    
    const result = await assignUseCase.execute(tenantId, email, 'admin', { correlationId });
    assert.strictEqual(result.userId, email);
    assert.strictEqual(result.role, 'admin');

    const event = result.event;
    assert.strictEqual(event.type, 'role.assigned');
    assert.strictEqual(event.version, 'v1');
    assert.strictEqual(event.tenantId, tenantId);
    assert.strictEqual(event.correlationId, correlationId);
    assert.strictEqual(event.payload.role, 'admin');
    
    const parts = event.eventId.split('-');
    assert.strictEqual(parts[2]?.[0], '7'); // Verify UUIDv7 version is 7
  });

  void test('TokenServiceGrpc should route grpc actions correctly', async () => {
    const grpcService = new TokenServiceGrpc();

    // 1. IssueToken
    const issueRes = await grpcService.issueToken({
      request: { email, password: 'correct_password' }
    });
    assert.ok(issueRes.accessToken);
    assert.ok(issueRes.refreshToken);

    // 2. VerifyToken
    const verifyRes = await grpcService.verifyToken({
      request: { accessToken: issueRes.accessToken }
    });
    assert.strictEqual(verifyRes.valid, true);
    assert.strictEqual(verifyRes.principalId, email);

    // 3. RefreshToken
    const refreshRes = await grpcService.refreshToken({
      request: { refreshToken: issueRes.refreshToken }
    });
    assert.ok(refreshRes.accessToken);
    assert.ok(refreshRes.refreshToken);
  });

  void test('AuthController should orchestrate login and verify endpoints', async () => {
    const controller = new AuthController();

    // 1. Post Login
    const loginResult = await controller.handlePostLogin(
      { email, password: 'password123' },
      { 'x-tenant-id': tenantId }
    );
    assert.strictEqual(loginResult.statusCode, 200);
    assert.strictEqual(loginResult.body.success, true);
    
    const token = loginResult.body.accessToken as string;
    assert.ok(token);

    // 2. Post Verify
    const verifyResult = await controller.handlePostVerify(
      { token },
      {}
    );
    assert.strictEqual(verifyResult.statusCode, 200);
    assert.strictEqual(verifyResult.body.valid, true);
    
    const claims = verifyResult.body.claims as Record<string, unknown>;
    assert.strictEqual(claims['email'], email);
  });

  void test('KeyManager and AuthController should support automatic key rotation and JWKS output', async () => {
    const { KeyManager } = await import('./application/usecases/key_manager.js');
    const keyManager = KeyManager.getInstance();
    keyManager.clear();

    const controller = new AuthController();

    // 1. Get initial JWKS keys
    const jwksResult1 = await controller.handleGetJwks();
    assert.strictEqual(jwksResult1.statusCode, 200);
    
    const body1 = jwksResult1.body as { keys: Array<{ kid: string }> };
    assert.ok(body1.keys);
    assert.strictEqual(body1.keys.length, 1);
    const firstKid = body1.keys[0].kid;

    // 2. Rotate keys
    const newKey = keyManager.rotate();
    const jwksResult2 = await controller.handleGetJwks();
    const body2 = jwksResult2.body as { keys: Array<{ kid: string }> };
    assert.strictEqual(body2.keys.length, 2);
    assert.strictEqual(body2.keys[0].kid, newKey.kid);
    assert.strictEqual(body2.keys[1].kid, firstKid);

    // 3. Issue token using the new key, and verify it still decodes properly
    const issueUsecase = new IssueTokenUseCase(refreshTokenRepo);
    const verifyUsecase = new VerifyTokenUseCase();
    const pair = await issueUsecase.execute(tenantId, email, roles);

    // Header should contain the new kid
    const parts = pair.accessToken.split('.');
    const header = JSON.parse(Buffer.from(parts[0]!, 'base64url').toString('utf8')) as { kid: string };
    assert.strictEqual(header.kid, newKey.kid);

    // Verify should work
    const claims = await verifyUsecase.execute(pair.accessToken);
    assert.strictEqual(claims.sub, email);
  });

  void test('IssueTokenUseCase should support OIDC SSO and MFA OTP validation checks', async () => {
    const issueUsecase = new IssueTokenUseCase(refreshTokenRepo);

    // 1. Success with SSO
    const pairSso = await issueUsecase.execute(tenantId, 'sso_user@enterprise.com', roles, undefined, 'valid_sso_token');
    assert.ok(pairSso.accessToken);

    // 2. Success with MFA code
    const pairMfa = await issueUsecase.execute(tenantId, email, roles, 'secure_password', undefined, '123456');
    assert.ok(pairMfa.accessToken);

    // 3. Failure with invalid SSO
    await assert.rejects(
      async () => {
        await issueUsecase.execute(tenantId, email, roles, undefined, 'invalid_sso_token');
      },
      (err: unknown) => (err as Error).message === 'Invalid SSO token'
    );

    // 4. Failure with invalid MFA code (non-digit)
    await assert.rejects(
      async () => {
        await issueUsecase.execute(tenantId, email, roles, 'secure_password', undefined, 'abc123');
      },
      (err: unknown) => (err as Error).message === 'Invalid MFA verification code'
    );
  });
});

