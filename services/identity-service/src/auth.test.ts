import { test, describe } from 'node:test';
import assert from 'node:assert';
import { IssueTokenUseCase } from './application/usecases/issue_token.usecase.js';
import { VerifyTokenUseCase } from './application/usecases/verify_token.usecase.js';
import { RefreshTokenUseCase } from './application/usecases/refresh_token.usecase.js';
import { AssignRoleUseCase } from './application/usecases/assign_role.usecase.js';
import { TokenServiceGrpc } from './presentation/grpc/token_service.grpc.js';
import { AuthController } from './presentation/rest/controllers/auth.controller.js';
import { SessionStore } from './application/usecases/session_store.js';

describe('Identity & Auth Verification Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const email = 'agent@enterprise-dms.com';
  const roles = ['agent'];

  test('IssueTokenUseCase should generate standard RS256 JWT and refresh token', async () => {
    const issueUsecase = new IssueTokenUseCase();
    const tokenPair = await issueUsecase.execute(tenantId, email, roles);

    assert.ok(tokenPair.accessToken);
    assert.ok(tokenPair.refreshToken);
    assert.strictEqual(tokenPair.expiresIn, 3600);

    // Verify it is structured as header.payload.signature
    const parts = tokenPair.accessToken.split('.');
    assert.strictEqual(parts.length, 3);
  });

  test('IssueTokenUseCase should verify credentials using scrypt', async () => {
    const issueUsecase = new IssueTokenUseCase();
    
    // Correct login
    const pair = await issueUsecase.execute(tenantId, email, roles, 'secure_pass_123');
    assert.ok(pair.accessToken);

    // Incorrect login
    await assert.rejects(
      async () => {
        await issueUsecase.execute(tenantId, email, roles, 'wrong_password');
      },
      (err: any) => err.message === 'Invalid credentials'
    );
  });

  test('VerifyTokenUseCase should decode and validate signed RS256 JWT claims', async () => {
    const issueUsecase = new IssueTokenUseCase();
    const verifyUsecase = new VerifyTokenUseCase();

    const tokenPair = await issueUsecase.execute(tenantId, email, roles);
    const claims = await verifyUsecase.execute(tokenPair.accessToken);

    assert.strictEqual(claims.sub, email);
    assert.strictEqual(claims.email, email);
    assert.strictEqual(claims.tenantId, tenantId);
    assert.deepStrictEqual(claims.roles, roles);
    assert.ok(claims.exp > claims.iat);
  });

  test('VerifyTokenUseCase should fail for tampered signatures', async () => {
    const issueUsecase = new IssueTokenUseCase();
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
      (err: any) => {
        return err.message === 'Invalid JWT signature';
      }
    );
  });

  test('RefreshTokenUseCase should support rotation and reuse detection (revocation)', async () => {
    SessionStore.getInstance().clearAll();

    const issueUsecase = new IssueTokenUseCase();
    const refreshUsecase = new RefreshTokenUseCase();

    const pair1 = await issueUsecase.execute(tenantId, email, roles);
    const rt1 = pair1.refreshToken;

    // First rotation (valid)
    const pair2 = await refreshUsecase.execute(rt1);
    const rt2 = pair2.refreshToken;
    assert.ok(rt2);
    assert.notStrictEqual(rt1, rt2);

    // Reuse rotation (invalid, must throw and revoke)
    await assert.rejects(
      async () => {
        await refreshUsecase.execute(rt1); // Reusing rt1
      },
      (err: any) => err.message.includes('reuse detected')
    );

    // Verify rt2 was revoked due to family revocation
    await assert.rejects(
      async () => {
        await refreshUsecase.execute(rt2);
      },
      (err: any) => err.message === 'Invalid refresh token'
    );
  });

  test('AssignRoleUseCase should raise role.assigned.v1 event', async () => {
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

  test('TokenServiceGrpc should route grpc actions correctly', async () => {
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

  test('AuthController should orchestrate login and verify endpoints', async () => {
    const controller = new AuthController();

    // 1. Post Login
    const loginResult = await controller.handlePostLogin(
      { email, password: 'password123' },
      { 'x-tenant-id': tenantId }
    );
    assert.strictEqual(loginResult.statusCode, 200);
    assert.strictEqual(loginResult.body.success, true);
    
    const token = loginResult.body.accessToken;
    assert.ok(token);

    // 2. Post Verify
    const verifyResult = await controller.handlePostVerify(
      { token },
      {}
    );
    assert.strictEqual(verifyResult.statusCode, 200);
    assert.strictEqual(verifyResult.body.valid, true);
    assert.strictEqual(verifyResult.body.claims.email, email);
  });
});
