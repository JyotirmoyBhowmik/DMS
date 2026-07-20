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
import { MerchandisingAuditPgRepository } from '../../sfa-service/src/infrastructure/database/repositories/merchandising-audit.pg-repository.js';

const config = loadConfigSync();

describe('Gateway SFA MerchandisingAudit API Integration Tests', () => {
  let gateway: GatewayController;
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const otherTenantId = '00000000-0000-0000-0000-000000000002';
  let adminToken: string;
  let agentToken: string;
  let unauthorizedToken: string;

  beforeEach(() => {
    KeyManager.getInstance().clear();
    gateway = new GatewayController();
    MerchandisingAuditPgRepository.clearStore();

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

  test('Gateway should route Create MerchandisingAudit successfully', async () => {
    const res = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/merchandising-audits',
      headers: {
        'authorization': `Bearer ${agentToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        id: '00000000-0000-0000-0000-000000000111',
        agentId: '00000000-0000-0000-0000-000000000222',
        outletId: '00000000-0000-0000-0000-000000000333',
        auditDate: '2026-07-19',
        planogramCompliance: 90,
        displayScore: 95,
      },
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok((res.body.audit as any).id);
  });

  test('Gateway should enforce validation rules and reject bad inputs', async () => {
    const res = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/merchandising-audits',
      headers: {
        'authorization': `Bearer ${agentToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        id: '00000000-0000-0000-0000-000000000111',
        agentId: '00000000-0000-0000-0000-000000000222',
        outletId: '00000000-0000-0000-0000-000000000333',
        auditDate: '2026-07-19',
        planogramCompliance: 150, // invalid: must be 0-100
      },
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  test('Gateway should support state machine lifecycle transitions via PUT', async () => {
    const auditId = '00000000-0000-0000-0000-000000005555';
    // 1. Create audit
    await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/merchandising-audits',
      headers: {
        'authorization': `Bearer ${agentToken}`,
        'x-tenant-id': tenantId,
      },
      body: {
        id: auditId,
        agentId: '00000000-0000-0000-0000-000000000222',
        outletId: '00000000-0000-0000-0000-000000000333',
        auditDate: '2026-07-19',
      },
    });

    // 2. Submit by Agent
    const submitRes = await gateway.handleRequest({
      method: 'PUT',
      path: `/api/v1/merchandising-audits/${auditId}`,
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
    assert.strictEqual((submitRes.body.audit as any).status, 'SUBMITTED');

    // 3. Approve by Admin
    const approveRes = await gateway.handleRequest({
      method: 'PUT',
      path: `/api/v1/merchandising-audits/${auditId}`,
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
      },
      body: {
        status: 'APPROVED',
        version: 1,
      },
    });
    assert.strictEqual(approveRes.status, 200);
    assert.strictEqual((approveRes.body.audit as any).status, 'APPROVED');
  });

  test('Gateway should reject cross-tenant reads', async () => {
    const auditId = '00000000-0000-0000-0000-000000006666';
    await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/merchandising-audits',
      headers: {
        'authorization': `Bearer ${agentToken}`,
        'x-tenant-id': tenantId,
      },
      body: {
        id: auditId,
        agentId: '00000000-0000-0000-0000-000000000222',
        outletId: '00000000-0000-0000-0000-000000000333',
        auditDate: '2026-07-19',
      },
    });

    const getRes = await gateway.handleRequest({
      method: 'GET',
      path: `/api/v1/merchandising-audits/${auditId}`,
      headers: {
        'authorization': `Bearer ${unauthorizedToken}`,
        'x-tenant-id': otherTenantId,
      },
    });

    assert.ok(getRes.status === 403 || getRes.status === 404);
  });

  test('Gateway should enforce delete permissions (403 for Agent)', async () => {
    const auditId = '00000000-0000-0000-0000-000000007777';
    await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/merchandising-audits',
      headers: {
        'authorization': `Bearer ${agentToken}`,
        'x-tenant-id': tenantId,
      },
      body: {
        id: auditId,
        agentId: '00000000-0000-0000-0000-000000000222',
        outletId: '00000000-0000-0000-0000-000000000333',
        auditDate: '2026-07-19',
      },
    });

    const deleteRes = await gateway.handleRequest({
      method: 'DELETE',
      path: `/api/v1/merchandising-audits/${auditId}`,
      headers: {
        'authorization': `Bearer ${agentToken}`,
        'x-tenant-id': tenantId,
      },
    });

    assert.strictEqual(deleteRes.status, 403);
  });
});
