import { test, describe } from 'node:test';
import assert from 'node:assert';
import { IssueTokenUseCase } from './application/usecases/issue_token.usecase.js';
import { VerifyTokenUseCase } from './application/usecases/verify_token.usecase.js';
import { AuthController } from './presentation/rest/controllers/auth.controller.js';

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
