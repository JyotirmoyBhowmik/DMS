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
import { OutletCensusPgRepository } from '../../sfa-service/src/infrastructure/database/repositories/outlet-census.pg-repository.js';

const config = loadConfigSync();

describe('Gateway SFA OutletCensus API Integration Tests', () => {
  let gateway: GatewayController;
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const otherTenantId = '00000000-0000-0000-0000-000000000002';
  let adminToken: string;
  let unauthorizedToken: string;

  beforeEach(() => {
    KeyManager.getInstance().clear();
    gateway = new GatewayController();
    OutletCensusPgRepository.clearStore();

    // Generate signing keys
    const keyRecord = KeyManager.getInstance().getSigningKey();
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;

    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: keyRecord.kid })).toString('base64url');
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
    const sig1 = signer1.sign(keyRecord.privateKey, 'base64url');
    adminToken = `${header}.${adminPayload}.${sig1}`;

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

  test('Gateway should route Create OutletCensus successfully', async () => {
    const res = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/outlet-census',
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        agentId: '00000000-0000-0000-0000-000000000123',
        outletId: '00000000-0000-0000-0000-000000000456',
        censusDate: '2026-07-17',
        outletName: 'Sagar Store CP',
        outletType: 'kirana',
        ownerName: 'Sagar Kumar',
        ownerPhone: '9876543210',
        address: 'Shop 5, Connaught Place, New Delhi',
        geoCoords: { latitude: 28.6139, longitude: 77.2090 },
        tradeCategory: 'Groceries',
      },
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.outletCensusId);
  });

  test('Gateway should reject OutletCensus creation with schema validation errors (400)', async () => {
    const res = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/outlet-census',
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        agentId: 'invalid-uuid',
        outletId: '00000000-0000-0000-0000-000000000456',
        censusDate: 'invalid-date',
        outletName: '', // invalid name
        outletType: 'kirana',
        ownerName: 'Sagar Kumar',
        ownerPhone: '123', // invalid phone length
        address: 'Shop 5, New Delhi',
        geoCoords: { latitude: 28.6139, longitude: 77.2090 },
        tradeCategory: 'Groceries',
      },
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.message, 'Bad Request');
  });

  test('Gateway should reject cross-tenant OutletCensus access (404)', async () => {
    // 1. Create census under tenant 1
    const createRes = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/outlet-census',
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        agentId: '00000000-0000-0000-0000-000000000123',
        outletId: '00000000-0000-0000-0000-000000000456',
        censusDate: '2026-07-17',
        outletName: 'Sagar Store CP',
        outletType: 'kirana',
        ownerName: 'Sagar Kumar',
        ownerPhone: '9876543210',
        address: 'Shop 5, Connaught Place, New Delhi',
        geoCoords: { latitude: 28.6139, longitude: 77.2090 },
        tradeCategory: 'Groceries',
      },
    });
    assert.strictEqual(createRes.status, 201);
    const censusId = createRes.body.outletCensusId;

    // 2. Fetch using tenant 2 token
    const getRes = await gateway.handleRequest({
      method: 'GET',
      path: `/api/v1/outlet-census/${censusId}`,
      headers: {
        'authorization': `Bearer ${unauthorizedToken}`,
        'x-tenant-id': otherTenantId,
      },
    });

    assert.strictEqual(getRes.status, 404);
  });

  test('Gateway should reject OutletCensus creation with missing credentials (401)', async () => {
    const res = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/outlet-census',
      headers: {
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        agentId: '00000000-0000-0000-0000-000000000123',
        outletId: '00000000-0000-0000-0000-000000000456',
        censusDate: '2026-07-17',
        outletName: 'Sagar Store CP',
        outletType: 'kirana',
        ownerName: 'Sagar Kumar',
        ownerPhone: '9876543210',
        address: 'Shop 5, Connaught Place, New Delhi',
        geoCoords: { latitude: 28.6139, longitude: 77.2090 },
        tradeCategory: 'Groceries',
      },
    });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.code, 'AUTH_REQUIRED');
  });

  test('Gateway should reject oversized body payload for OutletCensus (413)', async () => {
    const oversizedPayload = 'X'.repeat(6 * 1024 * 1024); // 6MB
    const res = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/outlet-census',
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        agentId: '00000000-0000-0000-0000-000000000123',
        outletId: '00000000-0000-0000-0000-000000000456',
        censusDate: '2026-07-17',
        outletName: 'Sagar Store CP',
        outletType: 'kirana',
        ownerName: 'Sagar Kumar',
        ownerPhone: '9876543210',
        address: 'Shop 5, Connaught Place, New Delhi',
        geoCoords: { latitude: 28.6139, longitude: 77.2090 },
        tradeCategory: 'Groceries',
        extraField: oversizedPayload,
      },
    });

    assert.strictEqual(res.status, 413);
  });

  test('Gateway should reject malicious SQL/NoSQL injection payloads for OutletCensus', async () => {
    const res = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/outlet-census',
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        agentId: "00000000-0000-0000-0000-000000000123' OR '1'='1",
        outletId: '00000000-0000-0000-0000-000000000456',
        censusDate: '2026-07-17',
        outletName: 'Sagar Store CP',
        outletType: 'kirana',
        ownerName: 'Sagar Kumar',
        ownerPhone: '9876543210',
        address: 'Shop 5, Connaught Place, New Delhi',
        geoCoords: { latitude: 28.6139, longitude: 77.2090 },
        tradeCategory: 'Groceries',
      },
    });

    // Zod validation on agentId UUID format will fail first and return 400
    assert.strictEqual(res.status, 400);
  });

  test('Gateway should list OutletCensus with pagination caps (max 100)', async () => {
    const res = await gateway.handleRequest({
      method: 'GET',
      path: '/api/v1/outlet-census',
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        pageSize: 200,
      },
    });

    assert.strictEqual(res.status, 200);
    assert.ok((res.body as any).pageSize <= 100);
  });
});
