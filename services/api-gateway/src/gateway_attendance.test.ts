process.env.PGUSER = process.env.PGUSER || 'user';
process.env.PGPASSWORD = process.env.PGPASSWORD || 'password';
process.env.PGDATABASE = process.env.PGDATABASE || 'dms';
process.env.PGHOST = process.env.PGHOST || 'localhost';
process.env.PGPORT = process.env.PGPORT || '5432';

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createSign } from 'node:crypto';
import { GatewayController } from './presentation/rest/controllers/gateway.controller.js';
import { KeyManager } from '../../identity-service/src/application/usecases/key_manager.js';
import { loadConfigSync } from '@dms/pkg-config';
import { AttendancePgRepository } from '../../sfa-service/src/infrastructure/database/repositories/attendance.pg-repository.js';

const config = loadConfigSync();

describe('Gateway SFA Attendance API Integration Tests', () => {
  let gateway: GatewayController;
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const otherTenantId = '00000000-0000-0000-0000-000000000002';
  let agentToken: string;
  let unauthorizedToken: string;

  beforeEach(() => {
    KeyManager.getInstance().clear();
    gateway = new GatewayController();
    AttendancePgRepository.clearStore();

    // Generate mock token for authorized agent
    const keyRecord = KeyManager.getInstance().getSigningKey();
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;

    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: keyRecord.kid })).toString('base64url');
    const agentPayload = Buffer.from(JSON.stringify({
      sub: 'agent-123',
      email: 'agent@enterprise.com',
      tenantId,
      roles: ['admin'], 
      iss: config.security.jwtIssuer,
      aud: config.security.jwtAudience,
      iat,
      exp,
    })).toString('base64url');

    const signer1 = createSign('RSA-SHA256');
    signer1.update(`${header}.${agentPayload}`);
    const sig1 = signer1.sign(keyRecord.privateKey, 'base64url');
    agentToken = `${header}.${agentPayload}.${sig1}`;

    // Token for an agent from a different tenant
    const unauthorizedPayload = Buffer.from(JSON.stringify({
      sub: 'agent-456',
      email: 'other@enterprise.com',
      tenantId: otherTenantId,
      roles: ['admin'],
      iss: config.security.jwtIssuer,
      aud: config.security.jwtAudience,
      iat,
      exp,
    })).toString('base64url');

    const signer2 = createSign('RSA-SHA256');
    signer2.update(`${header}.${unauthorizedPayload}`);
    const sig2 = signer2.sign(keyRecord.privateKey, 'base64url');
    unauthorizedToken = `${header}.${unauthorizedPayload}.${sig2}`;
  });

  test('Gateway should authorize and create attendance check-in successfully', async () => {
    const res = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/attendance',
      headers: {
        'authorization': `Bearer ${agentToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        agentId: '00000000-0000-0000-0000-000000000123',
        date: '2026-07-17',
      },
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.attendanceId);
  });

  test('Gateway should reject check-in with missing token (401)', async () => {
    const res = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/attendance',
      headers: {
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        agentId: '00000000-0000-0000-0000-000000000123',
        date: '2026-07-17',
      },
    });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.code, 'AUTH_REQUIRED');
  });

  test('Gateway should reject check-in with invalid token (401)', async () => {
    const res = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/attendance',
      headers: {
        'authorization': 'Bearer invalid-token-string',
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        agentId: '00000000-0000-0000-0000-000000000123',
        date: '2026-07-17',
      },
    });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.code, 'INVALID_TOKEN');
  });

  test('Gateway should reject check-in with schema validation errors (400)', async () => {
    const res = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/attendance',
      headers: {
        'authorization': `Bearer ${agentToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        agentId: 'not-a-uuid',
        date: '17-07-2026', // invalid date format
      },
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.message, 'Bad Request');
  });

  test('Gateway should enforce cross-tenant access rejection', async () => {
    // 1. Create attendance for Tenant 1
    const createRes = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/attendance',
      headers: {
        'authorization': `Bearer ${agentToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        agentId: '00000000-0000-0000-0000-000000000123',
        date: '2026-07-17',
      },
    });
    assert.strictEqual(createRes.status, 201);
    const attendanceId = createRes.body.attendanceId;

    // 2. Attempt retrieval of Tenant 1's attendance using Tenant 2 token
    const getRes = await gateway.handleRequest({
      method: 'GET',
      path: `/api/v1/attendance/${attendanceId}`,
      headers: {
        'authorization': `Bearer ${unauthorizedToken}`,
        'x-tenant-id': otherTenantId,
      },
    });

    // Should return 404/not found or forbidden since tenants are isolated
    assert.strictEqual(getRes.status, 404);
  });

  test('Gateway should protect against payload size restrictions (oversized requests)', async () => {
    const oversizedBody = 'A'.repeat(10 * 1024 * 1024); // 10MB payload
    const res = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/attendance',
      headers: {
        'authorization': `Bearer ${agentToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        agentId: '00000000-0000-0000-0000-000000000123',
        date: '2026-07-17',
        extraData: oversizedBody,
      },
    });

    // Should reject with payload too large
    assert.ok(res.status === 413 || res.status === 400);
  });

  test('Gateway should reject malicious SQL/NoSQL injection payloads gracefully', async () => {
    const res = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/attendance',
      headers: {
        'authorization': `Bearer ${agentToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        agentId: "00000000-0000-0000-0000-000000000123' OR 1=1;--",
        date: '2026-07-17',
      },
    });

    // Validation schema should catch the invalid UUID and reject with 400
    assert.strictEqual(res.status, 400);
  });
});
