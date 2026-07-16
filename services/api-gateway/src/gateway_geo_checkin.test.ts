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
import { GeoCheckInPgRepository } from '../../sfa-service/src/infrastructure/database/repositories/geo-checkin.pg-repository.js';

const config = loadConfigSync();

describe('Gateway SFA GeoCheckIn API Integration Tests', () => {
  let gateway: GatewayController;
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const otherTenantId = '00000000-0000-0000-0000-000000000002';
  let adminToken: string;
  let unauthorizedToken: string;

  beforeEach(() => {
    KeyManager.getInstance().clear();
    gateway = new GatewayController();
    GeoCheckInPgRepository.clearStore();

    // Generate signing key for tokens
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

  test('Gateway should route Create GeoCheckIn successfully', async () => {
    const res = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/geo-check-in',
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        agentId: '00000000-0000-0000-0000-000000000123',
        outletId: '00000000-0000-0000-0000-000000000456',
        checkInCoords: { latitude: 28.6139, longitude: 77.2090 },
        outletCoords: { latitude: 28.6139, longitude: 77.2090 },
        deviceInfo: { model: 'OnePlus 11', os: 'Android 13', batteryLevel: 80 },
      },
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.geoCheckInId);
  });

  test('Gateway should reject GeoCheckIn check-in with schema validation errors (400)', async () => {
    const res = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/geo-check-in',
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        agentId: 'invalid-uuid',
        outletId: '00000000-0000-0000-0000-000000000456',
        checkInCoords: { latitude: 200, longitude: 77.2090 }, // invalid latitude
        outletCoords: { latitude: 28.6139, longitude: 77.2090 },
        deviceInfo: { model: 'OnePlus 11', os: 'Android 13', batteryLevel: 80 },
      },
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.message, 'Bad Request');
  });

  test('Gateway should reject GeoCheckIn with missing credentials (401)', async () => {
    const res = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/geo-check-in',
      headers: {
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        agentId: '00000000-0000-0000-0000-000000000123',
        outletId: '00000000-0000-0000-0000-000000000456',
        checkInCoords: { latitude: 28.6139, longitude: 77.2090 },
        outletCoords: { latitude: 28.6139, longitude: 77.2090 },
        deviceInfo: { model: 'OnePlus 11', os: 'Android 13', batteryLevel: 80 },
      },
    });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.code, 'AUTH_REQUIRED');
  });

  test('Gateway should reject cross-tenant GeoCheckIn access (404)', async () => {
    // 1. Create check-in under tenant 1
    const createRes = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/geo-check-in',
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        agentId: '00000000-0000-0000-0000-000000000123',
        outletId: '00000000-0000-0000-0000-000000000456',
        checkInCoords: { latitude: 28.6139, longitude: 77.2090 },
        outletCoords: { latitude: 28.6139, longitude: 77.2090 },
        deviceInfo: { model: 'OnePlus 11', os: 'Android 13', batteryLevel: 80 },
      },
    });
    assert.strictEqual(createRes.status, 201);
    const checkInId = createRes.body.geoCheckInId;

    // 2. Fetch using tenant 2 token
    const getRes = await gateway.handleRequest({
      method: 'GET',
      path: `/api/v1/geo-check-in/${checkInId}`,
      headers: {
        'authorization': `Bearer ${unauthorizedToken}`,
        'x-tenant-id': otherTenantId,
      },
    });

    assert.strictEqual(getRes.status, 404);
  });

  test('Gateway should reject oversized body payload for GeoCheckIn (413)', async () => {
    const oversizedPayload = 'A'.repeat(5 * 1024 * 1024); // 5MB
    const res = await gateway.handleRequest({
      method: 'POST',
      path: '/api/v1/geo-check-in',
      headers: {
        'authorization': `Bearer ${adminToken}`,
        'x-tenant-id': tenantId,
        'content-type': 'application/json',
      },
      body: {
        agentId: '00000000-0000-0000-0000-000000000123',
        outletId: '00000000-0000-0000-0000-000000000456',
        checkInCoords: { latitude: 28.6139, longitude: 77.2090 },
        outletCoords: { latitude: 28.6139, longitude: 77.2090 },
        deviceInfo: { model: 'OnePlus 11', os: 'Android 13', batteryLevel: 80 },
        extra: oversizedPayload,
      },
    });

    assert.strictEqual(res.status, 413);
  });
});
