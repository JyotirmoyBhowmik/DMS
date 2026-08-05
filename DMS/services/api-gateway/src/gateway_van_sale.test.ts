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
import { VanSalePgRepository } from '../../sfa-service/src/infrastructure/database/repositories/van-sale.pg-repository.js';

const config = loadConfigSync();

describe('Gateway SFA VanSale API Integration Tests', () => {
  let gateway: GatewayController;
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const otherTenantId = '00000000-0000-0000-0000-000000000002';
  let adminToken: string;
  let agentToken: string;
  let unauthorizedToken: string;

  beforeEach(() => {
    KeyManager.getInstance().clear();
    gateway = new GatewayController();
    VanSalePgRepository.clearStore();

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

  test('Gateway should route Create VanSale successfully', async () => {
    const res = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/van-sales',
      headers: {
        'authorization': `Bearer ${agentToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        id: '00000000-0000-0000-0000-000000000111',
        agentId: '00000000-0000-0000-0000-000000000222',
        vehicleId: '00000000-0000-0000-0000-000000000333',
        routeId: '00000000-0000-0000-0000-000000000444',
        date: '2026-06-25',
        loadedItems: [
          { skuId: '00000000-0000-0000-0000-000000000555', qty: 100, batchNumber: 'BAT-ABC' }
        ]
      },
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.vanSaleId);
  });

  test('Gateway should enforce default-deny for delete to agent role (403)', async () => {
    // 1. Create a session via admin
    const createRes = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/van-sales',
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        id: '00000000-0000-0000-0000-000000009999',
        agentId: '00000000-0000-0000-0000-000000000888',
        vehicleId: '00000000-0000-0000-0000-000000000333',
        routeId: '00000000-0000-0000-0000-000000000444',
        date: '2026-06-25',
      },
    });
    assert.strictEqual(createRes.status, 201);

    // 2. Attempt to delete using Agent role token
    const deleteRes = await gateway.handleRequest({
      method: 'DELETE',
      path: '/api/v1/van-sales/00000000-0000-0000-0000-000000009999',
      headers: {
        'authorization': `Bearer ${agentToken}`,
        'x-tenant-id': tenantId,
      },
      body: null,
    });

    assert.strictEqual(deleteRes.status, 403);
  });

  test('Gateway should reject cross-tenant requests (403/404)', async () => {
    // 1. Create a session under tenantId
    const createRes = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/van-sales',
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        id: '00000000-0000-0000-0000-000000008888',
        agentId: '00000000-0000-0000-0000-000000000888',
        vehicleId: '00000000-0000-0000-0000-000000000333',
        routeId: '00000000-0000-0000-0000-000000000444',
        date: '2026-06-25',
      },
    });
    assert.strictEqual(createRes.status, 201);

    // 2. Fetch using otherTenantId token
    const getRes = await gateway.handleRequest({
      method: 'GET',
      path: '/api/v1/van-sales/00000000-0000-0000-0000-000000008888',
      headers: {
        'authorization': `Bearer ${unauthorizedToken}`,
        'x-tenant-id': otherTenantId,
      },
      body: null,
    });

    // Tenant mismatch in usecase/controller returns 403 or 404 (due to RLS tenant isolation hiding resource details)
    assert.ok(getRes.status === 403 || getRes.status === 404);
  });
});
