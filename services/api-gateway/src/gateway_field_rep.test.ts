import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createSign } from 'node:crypto';
import { GatewayController } from './presentation/rest/controllers/gateway.controller.js';
import { FieldRepController } from '../../sfa-service/src/presentation/rest/controllers/field-rep.controller.js';
import { KeyManager } from '../../identity-service/src/application/usecases/key_manager.js';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();
const tenantId = '00000000-0000-0000-0000-000000000001';
const otherTenantId = '00000000-0000-0000-0000-000000000002';
const userId = '00000000-0000-0000-0000-0000000000c1';

beforeEach(() => {
  FieldRepController.clearStore();
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

describe('Gateway SFA FieldRep API Integration Tests', () => {
  test('Gateway should route Create FieldRep successfully (Admin)', async () => {
    const adminToken = generateToken({
      sub: 'admin-user-id',
      tenantId,
      roles: ['admin'],
    });

    const gateway = new GatewayController();

    const request = {
      method: 'POST',
      path: '/api/v1/field-reps',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        id: '00000000-0000-0000-0000-0000000000e1',
        userId,
        employeeCode: 'EMP_INTEGRATION_001',
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice.smith@dms.com',
        phone: '1234567890',
      },
    };

    const response = await gateway.handleRequest(request);
    assert.strictEqual(response.status, 201);
    assert.strictEqual((response.body as any).success, true);
    assert.strictEqual((response.body as any).fieldRep.id, '00000000-0000-0000-0000-0000000000e1');
    assert.strictEqual((response.body as any).fieldRep.status, 'ACTIVE');
  });

  test('Gateway should reject create for standard agent role (403)', async () => {
    const agentToken = generateToken({
      sub: 'agent-user-id',
      tenantId,
      roles: ['agent'],
    });

    const gateway = new GatewayController();

    const request = {
      method: 'POST',
      path: '/api/v1/field-reps',
      headers: {
        authorization: `Bearer ${agentToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        id: '00000000-0000-0000-0000-0000000000e2',
        userId,
        employeeCode: 'EMP_INTEGRATION_002',
        firstName: 'Bob',
        lastName: 'Jones',
        email: 'bob.jones@dms.com',
        phone: '1234567890',
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
      path: '/api/v1/field-reps',
      headers: {
        authorization: `Bearer ${seedAdminToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        id: '00000000-0000-0000-0000-0000000000e3',
        userId,
        employeeCode: 'EMP_INTEGRATION_003',
        firstName: 'Charlie',
        lastName: 'Brown',
        email: 'charlie@dms.com',
        phone: '1234567890',
      },
    });

    const fetchRequest = {
      method: 'GET',
      path: '/api/v1/field-reps/00000000-0000-0000-0000-0000000000e3',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'x-tenant-id': otherTenantId,
      },
    };

    const response = await gateway.handleRequest(fetchRequest);
    assert.strictEqual(response.status === 403 || response.status === 404, true);
  });
});
