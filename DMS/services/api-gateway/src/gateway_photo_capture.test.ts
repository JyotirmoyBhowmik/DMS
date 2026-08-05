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
import { PhotoCapturePgRepository } from '../../sfa-service/src/infrastructure/database/repositories/photo-capture.pg-repository.js';

const config = loadConfigSync();

describe('Gateway SFA PhotoCapture API Integration Tests', () => {
  let gateway: GatewayController;
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const otherTenantId = '00000000-0000-0000-0000-000000000002';
  let adminToken: string;
  let agentToken: string;
  let unauthorizedToken: string;

  beforeEach(() => {
    KeyManager.getInstance().clear();
    gateway = new GatewayController();
    PhotoCapturePgRepository.clearStore();

    const keyRecord = KeyManager.getInstance().getSigningKey();
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;

    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: keyRecord.kid })).toString('base64url');

    // Admin Token
    const adminPayload = Buffer.from(JSON.stringify({
      sub: 'admin-123',
      email: 'admin@enterprise.com',
      tenantId,
      roles: ['admin'],
      iss: config.security.jwtIssuer,
      aud: config.security.jwtAudience,
      iat,
      exp,
    })).toString('base64url');
    const signer1 = createSign('RSA-SHA256');
    signer1.update(`${header}.${adminPayload}`);
    adminToken = `${header}.${adminPayload}.${signer1.sign(keyRecord.privateKey, 'base64url')}`;

    // Agent Token
    const agentPayload = Buffer.from(JSON.stringify({
      sub: 'agent-123',
      email: 'agent@enterprise.com',
      tenantId,
      roles: ['agent'],
      iss: config.security.jwtIssuer,
      aud: config.security.jwtAudience,
      iat,
      exp,
    })).toString('base64url');
    const signerAgent = createSign('RSA-SHA256');
    signerAgent.update(`${header}.${agentPayload}`);
    agentToken = `${header}.${agentPayload}.${signerAgent.sign(keyRecord.privateKey, 'base64url')}`;

    // Other Tenant Token
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
    unauthorizedToken = `${header}.${unauthorizedPayload}.${signer2.sign(keyRecord.privateKey, 'base64url')}`;
  });

  test('Gateway should route Create PhotoCapture successfully', async () => {
    const res = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/photo-captures',
      headers: {
        'authorization': `Bearer ${agentToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        id: '00000000-0000-0000-0000-000000000888',
        agentId: '00000000-0000-0000-0000-000000000222',
        outletId: '00000000-0000-0000-0000-000000000333',
        captureDate: '2026-07-19',
        photoUrl: 'https://images.com/storefront.jpg',
        tags: ['outlet-front'],
        notes: 'Good coverage',
      },
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok((res.body.capture as any).id);
  });

  test('Gateway should reject bad input (missing URL schema validation)', async () => {
    const res = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/photo-captures',
      headers: {
        'authorization': `Bearer ${agentToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        id: '00000000-0000-0000-0000-000000000888',
        agentId: '00000000-0000-0000-0000-000000000222',
        outletId: '00000000-0000-0000-0000-000000000333',
        captureDate: '2026-07-19',
        photoUrl: 'not-a-valid-url-format',
      },
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  test('Gateway should support state transitions PUT and reject conflicts', async () => {
    const captureId = '00000000-0000-0000-0000-000000000999';
    await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/photo-captures',
      headers: {
        'authorization': `Bearer ${agentToken}`,
        'x-tenant-id': tenantId,
      },
      body: {
        id: captureId,
        agentId: '00000000-0000-0000-0000-000000000222',
        outletId: '00000000-0000-0000-0000-000000000333',
        captureDate: '2026-07-19',
        photoUrl: 'https://images.com/storefront.jpg',
      },
    });

    // 1. Submit
    const submitRes = await gateway.handleRequest({
      method: 'PUT',
      path: `/api/v1/photo-captures/${captureId}`,
      headers: {
        'authorization': `Bearer ${agentToken}`,
        'x-tenant-id': tenantId,
      },
      body: {
        status: 'SUBMITTED',
        version: 0,
      },
    });
    assert.strictEqual(submitRes.status, 200);
    assert.strictEqual((submitRes.body.capture as any).status, 'SUBMITTED');

    // 2. Reject by Admin
    const rejectRes = await gateway.handleRequest({
      method: 'PUT',
      path: `/api/v1/photo-captures/${captureId}`,
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
      },
      body: {
        status: 'REJECTED',
        rejectionReason: 'Blurry photo',
        version: 1,
      },
    });
    assert.strictEqual(rejectRes.status, 200);
    assert.strictEqual((rejectRes.body.capture as any).status, 'REJECTED');
    assert.strictEqual((rejectRes.body.capture as any).notes, 'Blurry photo');
  });

  test('Gateway should enforce cross-tenant separation', async () => {
    const captureId = '00000000-0000-0000-0000-000000000998';
    await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/photo-captures',
      headers: {
        'authorization': `Bearer ${agentToken}`,
        'x-tenant-id': tenantId,
      },
      body: {
        id: captureId,
        agentId: '00000000-0000-0000-0000-000000000222',
        outletId: '00000000-0000-0000-0000-000000000333',
        captureDate: '2026-07-19',
        photoUrl: 'https://images.com/storefront.jpg',
      },
    });

    const getRes = await gateway.handleRequest({
      method: 'GET',
      path: `/api/v1/photo-captures/${captureId}`,
      headers: {
        'authorization': `Bearer ${unauthorizedToken}`,
        'x-tenant-id': otherTenantId,
      },
    });

    assert.ok(getRes.status === 403 || getRes.status === 404);
  });

  test('Gateway should reject deletion attempt by Agent (default-deny)', async () => {
    const captureId = '00000000-0000-0000-0000-000000000997';
    await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/photo-captures',
      headers: {
        'authorization': `Bearer ${agentToken}`,
        'x-tenant-id': tenantId,
      },
      body: {
        id: captureId,
        agentId: '00000000-0000-0000-0000-000000000222',
        outletId: '00000000-0000-0000-0000-000000000333',
        captureDate: '2026-07-19',
        photoUrl: 'https://images.com/storefront.jpg',
      },
    });

    const delRes = await gateway.handleRequest({
      method: 'DELETE',
      path: `/api/v1/photo-captures/${captureId}`,
      headers: {
        'authorization': `Bearer ${agentToken}`,
        'x-tenant-id': tenantId,
      },
    });

    assert.strictEqual(delRes.status, 403);
  });
});
