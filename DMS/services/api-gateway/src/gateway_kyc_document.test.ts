import { test, describe } from 'node:test';
import assert from 'node:assert';
import { KYCDocumentController } from '../../dms-core-service/src/presentation/rest/controllers/kyc-document.controller.js';
import { randomUUID } from 'node:crypto';

describe('Gateway & KYCDocument REST Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const headers = {
    'x-tenant-id': tenantId,
    'x-user-id': 'admin-user-id',
    'x-user-roles': 'admin',
  };

  test('Uploads, queries, and verifies KYCDocument endpoints via controller handlers', async () => {
    KYCDocumentController.clearStore();
    const controller = new KYCDocumentController();

    const distId = randomUUID();

    // 1. Upload KYC Document
    const createRes = await controller.handleCreate(
      {
        distributorId: distId,
        documentType: 'TRADE_LICENSE',
        documentNumber: 'TL-2026-9988',
      },
      headers
    );

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = (createRes.body.document as any).id;

    // 2. Query KYC Document Details
    const getRes = await controller.handleGet(createdId, headers);
    assert.strictEqual(getRes.statusCode, 200);
    assert.strictEqual((getRes.body.document as any).documentNumber, 'TL-2026-9988');

    // 3. Verify Document
    const verifyRes = await controller.handleVerify(
      createdId,
      {
        verifiedBy: '00000000-0000-0000-0000-000000000001',
        version: 1,
      },
      headers
    );
    assert.strictEqual(verifyRes.statusCode, 200);
    assert.strictEqual((verifyRes.body.document as any).verificationStatus, 'VERIFIED');

    // 4. Negative Security Test: Forbidden for unauthorized role
    const forbiddenRes = await controller.handleCreate(
      {
        distributorId: distId,
        documentType: 'FSSAI',
        documentNumber: 'FSSAI-999',
      },
      { ...headers, 'x-user-roles': 'unauthorized_role' }
    );
    assert.strictEqual(forbiddenRes.statusCode, 403);
  });
});
