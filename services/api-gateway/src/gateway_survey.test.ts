import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert';
import { createSign } from 'node:crypto';
import { GatewayController } from './presentation/rest/controllers/gateway.controller.js';
import { SurveyController } from '../../sfa-service/src/presentation/rest/controllers/survey.controller.js';
import { KeyManager } from '../../identity-service/src/application/usecases/key_manager.js';
import { loadConfigSync } from '@dms/pkg-config';

const config = loadConfigSync();
const tenantId = '00000000-0000-0000-0000-000000000001';
const otherTenantId = '00000000-0000-0000-0000-000000000002';
const agentId = '00000000-0000-0000-0000-0000000000a1';
const outletId = '00000000-0000-0000-0000-0000000000b1';

beforeEach(() => {
  SurveyController.clearStore();
  KeyManager.getInstance().clear();
});

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

describe('Gateway SFA Survey API Integration Tests', () => {
  test('Gateway should route Create Survey successfully (Agent)', async () => {
    const agentToken = generateToken({
      sub: 'agent-user-id',
      tenantId,
      roles: ['agent'],
    });

    const gateway = new GatewayController();

    const request = {
      method: 'POST',
      path: '/api/v1/surveys',
      headers: {
        authorization: `Bearer ${agentToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        id: '00000000-0000-0000-0000-0000000000f1',
        agentId,
        outletId,
        title: 'Integration Test Survey',
        description: 'Testing gateway routing and permission logic',
        status: 'DRAFT',
      },
    };

    const response = await gateway.handleRequest(request);
    assert.strictEqual(response.status, 201);
    assert.strictEqual((response.body as any).success, true);
    assert.strictEqual((response.body as any).survey.id, '00000000-0000-0000-0000-0000000000f1');
    assert.strictEqual((response.body as any).survey.status, 'DRAFT');
  });

  test('Gateway should reject cross-tenant requests (403/404)', async () => {
    const agentToken = generateToken({
      sub: 'agent-user-id',
      tenantId: otherTenantId,
      roles: ['agent'],
    });

    const seedToken = generateToken({
      sub: 'agent-user-id',
      tenantId,
      roles: ['agent'],
    });

    const gateway = new GatewayController();

    await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/surveys',
      headers: {
        authorization: `Bearer ${seedToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        id: '00000000-0000-0000-0000-0000000000f2',
        agentId,
        outletId,
        title: 'Seeded Survey',
        description: 'Should not be readable by other tenant',
      },
    });

    const fetchRequest = {
      method: 'GET',
      path: '/api/v1/surveys/00000000-0000-0000-0000-0000000000f2',
      headers: {
        authorization: `Bearer ${agentToken}`,
        'x-tenant-id': otherTenantId,
      },
    };

    const response = await gateway.handleRequest(fetchRequest);
    assert.strictEqual(response.status === 403 || response.status === 404, true);
  });
});
