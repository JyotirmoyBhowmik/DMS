import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createSign } from 'node:crypto';
import { GatewayController } from './presentation/rest/controllers/gateway.controller.js';
import { KPIAchievementController } from '../../sfa-service/src/presentation/rest/controllers/kpi-achievement.controller.js';
import { KeyManager } from '../../identity-service/src/application/usecases/key_manager.js';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();
const tenantId = '00000000-0000-0000-0000-000000000001';
const otherTenantId = '00000000-0000-0000-0000-000000000002';
const agentId = '00000000-0000-0000-0000-00000000000a';

beforeEach(() => {
  KPIAchievementController.clearStore();
  KeyManager.getInstance().clear();
});

// Helper to generate a mock RS256 token manually
function generateToken(payload: { sub: string; tenantId: string; roles: string[] }): string {
  const keyRecord = KeyManager.getInstance().getSigningKey();
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: keyRecord.kid })).toString('base64url');
  
  const tokenPayload = Buffer.from(JSON.stringify({
    ...payload,
    iss: config.security.jwtIssuer,
    aud: config.security.jwtAudience,
    iat,
    exp,
  })).toString('base64url');

  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${tokenPayload}`);
  return `${header}.${tokenPayload}.${signer.sign(keyRecord.privateKey, 'base64url')}`;
}

describe('Gateway SFA KPIAchievement API Integration Tests', () => {
  test('Gateway should route Create KPIAchievement successfully (Admin)', async () => {
    const adminToken = generateToken({
      sub: 'admin-user-id',
      tenantId,
      roles: ['admin'],
    });

    const gateway = new GatewayController();

    const request = {
      method: 'POST',
      path: '/api/v1/kpi-achievements',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        id: '00000000-0000-0000-0000-0000000000f1',
        agentId,
        kpiType: 'visits',
        periodMonth: 8,
        periodYear: 2026,
        targetValue: 150,
      },
    };

    const response = await gateway.handleRequest(request);
    assert.strictEqual(response.status, 201);
    assert.strictEqual((response.body as any).success, true);
    assert.strictEqual((response.body as any).kpiAchievement.id, '00000000-0000-0000-0000-0000000000f1');
    assert.strictEqual((response.body as any).kpiAchievement.status, 'DRAFT');
  });

  test('Gateway should reject create for standard agent role (403)', async () => {
    const agentToken = generateToken({
      sub: agentId,
      tenantId,
      roles: ['agent'],
    });

    const gateway = new GatewayController();

    const request = {
      method: 'POST',
      path: '/api/v1/kpi-achievements',
      headers: {
        authorization: `Bearer ${agentToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        id: '00000000-0000-0000-0000-0000000000f2',
        agentId,
        kpiType: 'visits',
        periodMonth: 8,
        periodYear: 2026,
        targetValue: 150,
      },
    };

    const response = await gateway.handleRequest(request);
    assert.strictEqual(response.status, 403);
    assert.strictEqual((response.body as any).success, false);
    assert.match((response.body as any).error, /Insufficient permissions/);
  });

  test('Gateway should reject cross-tenant requests (403/404)', async () => {
    const adminToken = generateToken({
      sub: 'admin-user-id',
      tenantId: otherTenantId,
      roles: ['admin'],
    });

    const seedAdminToken = generateToken({
      sub: 'admin-user-id',
      tenantId,
      roles: ['admin'],
    });

    const gateway = new GatewayController();

    await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/kpi-achievements',
      headers: {
        authorization: `Bearer ${seedAdminToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        id: '00000000-0000-0000-0000-0000000000f3',
        agentId,
        kpiType: 'visits',
        periodMonth: 8,
        periodYear: 2026,
        targetValue: 150,
      },
    });

    const fetchRequest = {
      method: 'GET',
      path: '/api/v1/kpi-achievements/00000000-0000-0000-0000-0000000000f3',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-tenant-id': otherTenantId,
      },
    };

    const response = await gateway.handleRequest(fetchRequest);
    assert.strictEqual(response.status === 403 || response.status === 404, true);
  });
});
