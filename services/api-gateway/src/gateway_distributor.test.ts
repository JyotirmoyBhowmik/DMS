import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert';
import { GatewayController } from './presentation/rest/controllers/gateway.controller.js';
import { loadConfigSync } from '@dms/pkg-config';
import { KeyManager } from '../../identity-service/src/application/usecases/key_manager.js';
import { createSign } from 'node:crypto';
import { DistributorPgRepository } from '../../dms-core-service/src/infrastructure/database/repositories/distributor.pg-repository.js';

const config = loadConfigSync();

describe('Gateway Distributor CRUD Integration & Security Tests', () => {
  let gateway: GatewayController;
  const tenantA = 'a0000000-0000-4000-8000-000000000001';
  const tenantB = 'b0000000-0000-4000-8000-000000000002';
  const distIdA = 'a0000000-0000-4000-8000-000000000010';
  const distIdB = 'b0000000-0000-4000-8000-000000000020';

  before(() => {
    gateway = new GatewayController();
  });

  beforeEach(() => {
    DistributorPgRepository.clearStore();
  });

  function generateToken(role: string, tenantId: string): string {
    const keyRecord = KeyManager.getInstance().getSigningKey();
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;

    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: keyRecord.kid })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: 'test-user-id',
      email: 'test@enterprise-dms.com',
      tenantId,
      roles: [role],
      iss: config.security.jwtIssuer,
      aud: config.security.jwtAudience,
      iat,
      exp,
    })).toString('base64url');

    const signatureInput = `${header}.${payload}`;
    const signer = createSign('RSA-SHA256');
    signer.update(signatureInput);
    const signature = signer.sign(keyRecord.privateKey, 'base64url');
    return `${signatureInput}.${signature}`;
  }

  // ── 1. ROUTING & CREATION ──
  test('Gateway: Route Create Distributor successfully (Admin role)', async () => {
    const token = generateToken('admin', tenantA);
    const res = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/distributors',
      headers: {
        'authorization': `Bearer ${token}`,
        'x-tenant-id': tenantA,
      },
      body: {
        id: distIdA,
        name: 'Metro Distributor A',
        region: 'North',
        creditLimit: 1000000,
      },
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual((res.body.distributor as any).name, 'Metro Distributor A');
  });

  // ── 2. RBAC COS-DENY ──
  test('Gateway: Reject create request for unauthorized roles (Agent role)', async () => {
    const token = generateToken('agent', tenantA); // agent does not have distributor:create permission
    const res = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/distributors',
      headers: {
        'authorization': `Bearer ${token}`,
        'x-tenant-id': tenantA,
      },
      body: {
        id: distIdA,
        name: 'Agent Store Proposal',
        region: 'East',
        creditLimit: 1000000,
      },
    });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.match((res.body.error as string), /Insufficient permissions/);
  });

  // ── 3. TENANT ISOLATION CHECK ──
  test('Gateway: Enforce tenant boundary isolation (Tenant B cannot read Tenant A data)', async () => {
    const tokenA = generateToken('admin', tenantA);
    const tokenB = generateToken('admin', tenantB);

    // Create under Tenant A
    const createRes = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/distributors',
      headers: {
        'authorization': `Bearer ${tokenA}`,
        'x-tenant-id': tenantA,
      },
      body: {
        id: distIdA,
        name: 'Tenant A Distributor',
        region: 'North',
        creditLimit: 1000000,
      },
    });
    assert.strictEqual(createRes.status, 201);

    // Read using Tenant A token should succeed
    const getResA = await gateway.handleRequest({
      method: 'GET',
      path: `/api/v1/distributors/${distIdA}`,
      headers: {
        'authorization': `Bearer ${tokenA}`,
        'x-tenant-id': tenantA,
      },
    });
    assert.strictEqual(getResA.status, 200);

    // Read using Tenant B token should fail (returns 404 Not Found as the distributor is not in Tenant B's boundary)
    const getResB = await gateway.handleRequest({
      method: 'GET',
      path: `/api/v1/distributors/${distIdA}`,
      headers: {
        'authorization': `Bearer ${tokenB}`,
        'x-tenant-id': tenantB, // tenant id mismatch with the context requested
      },
    });
    assert.strictEqual(getResB.status, 404);
  });

  // ── 4. CONCURRENCY OPTIMISTIC LOCKING ──
  test('Gateway: Enforce concurrency version control on PUT requests', async () => {
    const token = generateToken('admin', tenantA);

    // Create distributor
    const createRes = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/distributors',
      headers: {
        'authorization': `Bearer ${token}`,
        'x-tenant-id': tenantA,
      },
      body: {
        id: distIdA,
        name: 'Original Name',
        region: 'North',
        creditLimit: 500000,
      },
    });
    assert.strictEqual(createRes.status, 201);

    // Success update (matching version 1)
    const updateRes1 = await gateway.handleRequest({
      method: 'PUT',
      path: `/api/v1/distributors/${distIdA}`,
      headers: {
        'authorization': `Bearer ${token}`,
        'x-tenant-id': tenantA,
      },
      body: {
        name: 'Updated Name 1',
        version: 1,
      },
    });
    assert.strictEqual(updateRes1.status, 200);
    assert.strictEqual((updateRes1.body.distributor as any).version, 2);

    // Conflict update (stale version 1)
    const updateRes2 = await gateway.handleRequest({
      method: 'PUT',
      path: `/api/v1/distributors/${distIdA}`,
      headers: {
        'authorization': `Bearer ${token}`,
        'x-tenant-id': tenantA,
      },
      body: {
        name: 'Updated Name 2',
        version: 1, // stale!
      },
    });
    assert.strictEqual(updateRes2.status, 409);
    assert.strictEqual(updateRes2.body.success, false);
    assert.match((updateRes2.body.error as string), /concurrency/i);
  });
});
