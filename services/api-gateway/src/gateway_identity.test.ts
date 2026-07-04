process.env.PGUSER = process.env.PGUSER || 'user';
process.env.PGPASSWORD = process.env.PGPASSWORD || 'password';
process.env.PGDATABASE = process.env.PGDATABASE || 'dms';
process.env.PGHOST = process.env.PGHOST || 'localhost';
process.env.PGPORT = process.env.PGPORT || '5432';

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { GatewayController } from './presentation/rest/controllers/gateway.controller.js';
import { KeyManager } from '../../identity-service/src/application/usecases/key_manager.js';
import { loadConfigSync } from '@dms/pkg-config';
import { createSign } from 'node:crypto';

const config = loadConfigSync();

describe('Gateway Identity CRUD Integration Tests', () => {
  let gateway: GatewayController;
  const tenantId = '00000000-0000-0000-0000-000000000001';
  let adminToken: string;

  beforeEach(() => {
    KeyManager.getInstance().clear();
    gateway = new GatewayController();

    // Generate mock admin token for routing auth/RBAC checks
    const keyRecord = KeyManager.getInstance().getSigningKey();
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;

    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: keyRecord.kid })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: 'admin@enterprise.com',
      email: 'admin@enterprise.com',
      tenantId,
      roles: ['admin'], // Has '*' wildcard permission in RbacGuard
      iss: config.security.jwtIssuer,
      aud: config.security.jwtAudience,
      iat,
      exp,
    })).toString('base64url');

    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${payload}`);
    const signature = signer.sign(keyRecord.privateKey, 'base64url');
    adminToken = `${header}.${payload}.${signature}`;
  });

  test('Gateway should route User CRUD requests successfully', async () => {
    // 1. Create User
    const createRes = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/users',
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
      },
      body: {
        email: 'gateway-user@test.com',
        password: 'password123',
        status: 'ACTIVE'
      }
    });
    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createRes.body.email, 'gateway-user@test.com');
    const userId = createRes.body.id as string;

    // 2. Get User
    const getRes = await gateway.handleRequest({
      method: 'GET',
      path: `/api/v1/users/${userId}`,
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
      }
    });
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.body.id, userId);

    // 3. Update User
    const updateRes = await gateway.handleRequest({
      method: 'PUT',
      path: `/api/v1/users/${userId}`,
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
      },
      body: {
        status: 'SUSPENDED'
      }
    });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.status, 'SUSPENDED');

    // 4. List Users
    const listRes = await gateway.handleRequest({
      method: 'GET',
      path: '/api/v1/users',
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
      }
    });
    assert.strictEqual(listRes.status, 200);
    assert.ok(Array.isArray(listRes.body.data));

    // 5. Delete User
    const deleteRes = await gateway.handleRequest({
      method: 'DELETE',
      path: `/api/v1/users/${userId}`,
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
      }
    });
    assert.strictEqual(deleteRes.status, 200);
    assert.strictEqual(deleteRes.body.success, true);
  });

  test('Gateway should route Role CRUD requests successfully', async () => {
    // 1. Create Role
    const createRes = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/roles',
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
      },
      body: {
        name: 'Supervisor',
        description: 'Supervisor role',
        isSystem: false
      }
    });
    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createRes.body.name, 'Supervisor');
    const roleId = createRes.body.id as string;

    // 2. Get Role
    const getRes = await gateway.handleRequest({
      method: 'GET',
      path: `/api/v1/roles/${roleId}`,
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
      }
    });
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.body.id, roleId);

    // 3. Update Role
    const updateRes = await gateway.handleRequest({
      method: 'PUT',
      path: `/api/v1/roles/${roleId}`,
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
      },
      body: {
        description: 'Updated supervisor description'
      }
    });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.description, 'Updated supervisor description');

    // 4. Delete Role
    const deleteRes = await gateway.handleRequest({
      method: 'DELETE',
      path: `/api/v1/roles/${roleId}`,
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
      }
    });
    assert.strictEqual(deleteRes.status, 200);
  });

  test('Gateway should route Tenant CRUD requests successfully', async () => {
    // 1. Create Tenant
    const createRes = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/tenants',
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
      },
      body: {
        name: 'Enterprise Tenant C',
        status: 'ACTIVE'
      }
    });
    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createRes.body.name, 'Enterprise Tenant C');
    const newTenantId = createRes.body.id as string;

    // 2. Get Tenant
    const getRes = await gateway.handleRequest({
      method: 'GET',
      path: `/api/v1/tenants/${newTenantId}`,
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
      }
    });
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.body.id, newTenantId);

    // 3. Update Tenant
    const updateRes = await gateway.handleRequest({
      method: 'PUT',
      path: `/api/v1/tenants/${newTenantId}`,
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
      },
      body: {
        status: 'SUSPENDED'
      }
    });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.status, 'SUSPENDED');

    // 4. Delete Tenant
    const deleteRes = await gateway.handleRequest({
      method: 'DELETE',
      path: `/api/v1/tenants/${newTenantId}`,
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
      }
    });
    assert.strictEqual(deleteRes.status, 200);
  });

  test('Gateway should route Permission CRUD requests successfully', async () => {
    // 1. Create Permission
    const createRes = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/permissions',
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
      },
      body: {
        name: 'invoices:read',
        resource: 'invoices',
        action: 'read',
        description: 'Read invoices permission'
      }
    });
    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createRes.body.name, 'invoices:read');
    const permId = createRes.body.id as string;

    // 2. Get Permission
    const getRes = await gateway.handleRequest({
      method: 'GET',
      path: `/api/v1/permissions/${permId}`,
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
      }
    });
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.body.id, permId);

    // 3. Update Permission
    const updateRes = await gateway.handleRequest({
      method: 'PUT',
      path: `/api/v1/permissions/${permId}`,
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
      },
      body: {
        description: 'Updated invoices read permission description'
      }
    });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.description, 'Updated invoices read permission description');

    // 4. Delete Permission
    const deleteRes = await gateway.handleRequest({
      method: 'DELETE',
      path: `/api/v1/permissions/${permId}`,
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
      }
    });
    assert.strictEqual(deleteRes.status, 200);
  });

  test('Gateway should route MFADevice CRUD requests successfully', async () => {
    // 1. Create MFADevice
    const createRes = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/mfa-devices',
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
      },
      body: {
        userId: 'gate-user-123',
        type: 'TOTP',
        secretEncrypted: 'encryptedsecretkeys',
        isActive: true
      }
    });
    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createRes.body.userId, 'gate-user-123');
    const mfaId = createRes.body.id as string;

    // 2. Get MFADevice
    const getRes = await gateway.handleRequest({
      method: 'GET',
      path: `/api/v1/mfa-devices/${mfaId}`,
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
      }
    });
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.body.id, mfaId);

    // 3. Update MFADevice
    const updateRes = await gateway.handleRequest({
      method: 'PUT',
      path: `/api/v1/mfa-devices/${mfaId}`,
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
      },
      body: {
        isActive: false
      }
    });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.isActive, false);

    // 4. Delete MFADevice
    const deleteRes = await gateway.handleRequest({
      method: 'DELETE',
      path: `/api/v1/mfa-devices/${mfaId}`,
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
      }
    });
    assert.strictEqual(deleteRes.status, 200);
  });
});
