process.env.PGUSER = process.env.PGUSER || 'user';
process.env.PGPASSWORD = process.env.PGPASSWORD || 'password';
process.env.PGDATABASE = process.env.PGDATABASE || 'dms';
process.env.PGHOST = process.env.PGHOST || 'localhost';
process.env.PGPORT = process.env.PGPORT || '5432';

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createSign } from 'node:crypto';
import { GatewayController } from './presentation/rest/controllers/gateway.controller.js';
import { AuthController } from '../../identity-service/src/presentation/rest/controllers/auth.controller.js';
import { AuditController } from '../../audit-service/src/presentation/rest/controllers/audit.controller.js';
import { KeyManager } from '../../identity-service/src/application/usecases/key_manager.js';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();

describe('Gateway Authentication & Authorization Integration Tests', () => {
  let gateway: GatewayController;
  let authController: AuthController;
  let auditController: AuditController;
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const email = 'agent@enterprise-dms.com';

  beforeEach(() => {
    // Reset KeyManager and controllers
    KeyManager.getInstance().clear();
    gateway = new GatewayController();
    authController = new AuthController();
    auditController = AuditController.getInstance();
    
    // Clear audit repository for clean tests
    auditController.getRepository().clear();
  });

  test('Protected route should reject request with missing token (401)', async () => {
    const result = await gateway.handleRequest({
      method: 'GET',
      path: '/api/v1/orders',
      headers: {
        'x-tenant-id': tenantId,
      },
    });

    assert.strictEqual(result.status, 401);
    assert.strictEqual(result.body.code, 'AUTH_REQUIRED');

    // Verify Audit Log
    const blocks = await auditController.getRepository().getAllBlocks();
    assert.ok(blocks.some(block => block.data && block.data.type === 'auth.access_denied'));
  });

  test('Protected route should reject request with invalid signature / tampered token (401)', async () => {
    // 1. Login to get a valid token
    const loginRes = await authController.handlePostLogin(
      { email, password: 'secure_password' },
      { 'x-tenant-id': tenantId }
    );
    assert.strictEqual(loginRes.statusCode, 200);
    const token = loginRes.body.accessToken as string;

    // 2. Tamper the token
    const parts = token.split('.');
    const header = parts[0];
    const originalPayload = Buffer.from(parts[1]!, 'base64url').toString('utf8');
    const payloadObj = JSON.parse(originalPayload);
    payloadObj.roles = ['admin']; // Attempt privilege escalation
    const tamperedPayloadB64 = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
    const tamperedToken = `${header}.${tamperedPayloadB64}.${parts[2]}`;

    // 3. Make request to gateway
    const result = await gateway.handleRequest({
      method: 'GET',
      path: '/api/v1/orders',
      headers: {
        'authorization': `Bearer ${tamperedToken}`,
        'x-tenant-id': tenantId,
      },
    });

    assert.strictEqual(result.status, 401);
    assert.strictEqual(result.body.code, 'INVALID_TOKEN');

    // Verify Audit Log has denied access
    const blocks = await auditController.getRepository().getAllBlocks();
    assert.ok(blocks.some(block => block.data && block.data.type === 'auth.access_denied'));
  });

  test('Protected route should reject expired token (401)', async () => {
    const keyRecord = KeyManager.getInstance().getSigningKey();
    const iat = Math.floor(Date.now() / 1000) - 3600;
    const exp = iat - 10; // Expired 10 seconds ago

    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: keyRecord.kid })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: email,
      email,
      tenantId,
      roles: ['admin'],
      iss: config.security.jwtIssuer,
      aud: config.security.jwtAudience,
      iat,
      exp,
    })).toString('base64url');

    const signatureInput = `${header}.${payload}`;
    const signer = createSign('RSA-SHA256');
    signer.update(signatureInput);
    const signature = signer.sign(keyRecord.privateKey, 'base64url');
    const expiredToken = `${signatureInput}.${signature}`;

    const result = await gateway.handleRequest({
      method: 'GET',
      path: '/api/v1/orders',
      headers: {
        'authorization': `Bearer ${expiredToken}`,
        'x-tenant-id': tenantId,
      },
    });

    assert.strictEqual(result.status, 401);
    assert.strictEqual(result.body.code, 'INVALID_TOKEN');
    assert.match(result.body.error as string, /expired/i);
  });

  test('Protected route should deny access for unauthorized roles / insufficient permissions (403)', async () => {
    // 1. Login as standard agent
    const loginRes = await authController.handlePostLogin(
      { email, password: 'secure_password' },
      { 'x-tenant-id': tenantId }
    );
    assert.strictEqual(loginRes.statusCode, 200);
    const token = loginRes.body.accessToken as string;

    // 2. Access /api/v1/orders which requires 'orders:read'.
    // Agent has 'order:read' but not 'orders:read'.
    const result = await gateway.handleRequest({
      method: 'GET',
      path: '/api/v1/orders',
      headers: {
        'authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
    });

    assert.strictEqual(result.status, 403);
    assert.strictEqual(result.body.code, 'FORBIDDEN');

    // Verify Audit Log records access denied
    const blocks = await auditController.getRepository().getAllBlocks();
    assert.ok(blocks.some(block => block.data && block.data.type === 'auth.access_denied' && String(block.data.result).includes('Insufficient permissions')));
  });

  test('Protected route should grant access for authorized roles (200) and record privilege use', async () => {
    // 1. Manually create an admin token
    const keyRecord = KeyManager.getInstance().getSigningKey();
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;

    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: keyRecord.kid })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: 'admin-user',
      email: 'admin@dms.com',
      tenantId,
      roles: ['admin'],
      iss: config.security.jwtIssuer,
      aud: config.security.jwtAudience,
      iat,
      exp,
    })).toString('base64url');

    const signatureInput = `${header}.${payload}`;
    const signer = createSign('RSA-SHA256');
    signer.update(signatureInput);
    const signature = signer.sign(keyRecord.privateKey, 'base64url');
    const adminToken = `${signatureInput}.${signature}`;

    // 2. Call /api/v1/orders
    const result = await gateway.handleRequest({
      method: 'GET',
      path: '/api/v1/orders',
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
      },
    });

    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.body.service, 'sfa-service');

    // Verify Audit Log records privilege use
    const blocks = await auditController.getRepository().getAllBlocks();
    assert.ok(blocks.some(block => block.data && block.data.type === 'auth.privilege_use' && String(block.data.result).includes('Granted access')));
  });

  test('Lockout policy should lock account for 15 minutes after 5 failed login attempts', async () => {
    // 1. Attempt login with wrong password 4 times
    for (let i = 1; i <= 4; i++) {
      const res = await authController.handlePostLogin(
        { email, password: 'wrong_password' },
        { 'x-tenant-id': tenantId }
      );
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.message, 'Invalid credentials');
    }

    // 2. 5th attempt locks the account
    const res5 = await authController.handlePostLogin(
      { email, password: 'wrong_password' },
      { 'x-tenant-id': tenantId }
    );
    assert.strictEqual(res5.statusCode, 429);
    assert.match(res5.body.message as string, /locked out/i);

    // 3. 6th attempt with CORRECT password is still locked out
    const res6 = await authController.handlePostLogin(
      { email, password: 'secure_password' },
      { 'x-tenant-id': tenantId }
    );
    assert.strictEqual(res6.statusCode, 429);
    assert.match(res6.body.message as string, /locked out/i);

    // Verify audit log has lockout record
    const blocks = await auditController.getRepository().getAllBlocks();
    assert.ok(blocks.some(block => block.data && block.data.type === 'auth.lockout'));
  });

  test('Rate limiting should trigger 429 on login endpoint after 10 requests', async () => {
    // 1. Make 10 requests quickly (should succeed or return credentials error but not rate limited)
    for (let i = 0; i < 10; i++) {
      await authController.handlePostLogin(
        { email, password: 'wrong_password' },
        { 'x-tenant-id': tenantId }
      );
    }

    // 2. 11th request triggers rate limit 429
    const res11 = await authController.handlePostLogin(
      { email, password: 'wrong_password' },
      { 'x-tenant-id': tenantId }
    );
    assert.strictEqual(res11.statusCode, 429);
    assert.match(res11.body.message as string, /too many/i);
  });
});
