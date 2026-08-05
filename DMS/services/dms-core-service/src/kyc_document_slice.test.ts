import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { KYCDocument } from './domain/entities/kyc-document.js';
import { KYCDocumentPgRepository } from './infrastructure/database/repositories/kyc-document.pg-repository.js';
import { CreateKYCDocumentUseCase } from './application/usecases/kyc-document/create-kyc-document.usecase.js';
import { GetKYCDocumentUseCase } from './application/usecases/kyc-document/get-kyc-document.usecase.js';
import { UpdateKYCDocumentUseCase } from './application/usecases/kyc-document/update-kyc-document.usecase.js';
import { ListKYCDocumentsUseCase } from './application/usecases/kyc-document/list-kyc-documents.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('KYCDocument Full Vertical Slice Unit & Repo Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const principal: Principal = {
    id: 'admin-user-1',
    tenantId,
    roles: ['admin'],
  };

  const mockDb: any = {
    query: async () => ({ rows: [] }),
  };

  beforeEach(() => {
    KYCDocumentPgRepository.clearStore();
  });

  test('Creates KYCDocument with idempotency key and enforces duplicate document type rejection', async () => {
    const repo = new KYCDocumentPgRepository(mockDb);
    const createUseCase = new CreateKYCDocumentUseCase(repo);

    const distId = randomUUID();
    const dto = {
      distributorId: distId,
      documentType: 'GSTIN' as const,
      documentNumber: '29AAAAA0000A1Z5',
    };

    // 1. Initial creation
    const doc1 = await createUseCase.execute(principal, dto, 'key-123');
    assert.strictEqual(doc1.documentNumber, '29AAAAA0000A1Z5');

    // 2. Idempotency retry with same key
    const doc2 = await createUseCase.execute(principal, dto, 'key-123');
    assert.strictEqual(doc2.id, doc1.id);

    // 3. Reject duplicate document type without idempotency key
    await assert.rejects(
      () => createUseCase.execute(principal, dto),
      /Distributor already has a GSTIN document registered/
    );
  });

  test('Executes Get, Update status (verify/reject), and List use cases with optimistic locking', async () => {
    const repo = new KYCDocumentPgRepository(mockDb);
    const createUseCase = new CreateKYCDocumentUseCase(repo);
    const getUseCase = new GetKYCDocumentUseCase(repo);
    const updateUseCase = new UpdateKYCDocumentUseCase(repo);
    const listUseCase = new ListKYCDocumentsUseCase(repo);

    const distId = randomUUID();
    const created = await createUseCase.execute(principal, {
      distributorId: distId,
      documentType: 'PAN' as const,
      documentNumber: 'ABCDE1234F',
    });

    // Get Use Case
    const fetched = await getUseCase.execute(principal, created.id);
    assert.notStrictEqual(fetched, null);
    assert.strictEqual(fetched?.documentNumber, 'ABCDE1234F');

    // List Use Case
    const list = await listUseCase.execute(principal, { distributorId: distId, verificationStatus: 'PENDING' });
    assert.strictEqual(list.total, 1);

    // Optimistic Concurrency Failure
    await assert.rejects(
      () => updateUseCase.execute(principal, created.id, { action: 'verify', version: 999 }),
      /Optimistic locking failure/
    );

    // Verify KYCDocument Success
    const verified = await updateUseCase.execute(principal, created.id, { action: 'verify', version: 1 });
    assert.strictEqual(verified.verificationStatus, 'VERIFIED');
    assert.strictEqual(verified.version, 2);
  });
});
