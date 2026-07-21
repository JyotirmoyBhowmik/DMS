import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { DistributorHierarchy } from './domain/entities/distributor-hierarchy.js';
import { KYCDocument } from './domain/entities/kyc-document.js';
import { DistributorHierarchyPgRepository } from './infrastructure/database/repositories/distributor-hierarchy.pg-repository.js';
import { KYCDocumentPgRepository } from './infrastructure/database/repositories/kyc-document.pg-repository.js';
import { GetDistributorHierarchyUseCase } from './application/usecases/distributor-hierarchy/get-distributor-hierarchy.usecase.js';
import { UpdateDistributorHierarchyUseCase } from './application/usecases/distributor-hierarchy/update-distributor-hierarchy.usecase.js';
import { ListDistributorHierarchiesUseCase } from './application/usecases/distributor-hierarchy/list-distributor-hierarchies.usecase.js';
import { Principal } from '@dms/pkg-rbac';
import { randomUUID } from 'node:crypto';

describe('DistributorHierarchy & KYCDocument Vertical Slice Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000001';
  const principal: Principal = {
    id: 'user-admin-1',
    tenantId,
    roles: ['admin'],
  };

  const mockDb: any = {
    query: async () => ({ rows: [] }),
  };

  beforeEach(() => {
    DistributorHierarchyPgRepository.clearStore();
  });

  describe('DistributorHierarchy Domain Aggregate', () => {
    test('rejects self-reference parent-child assignment', () => {
      const distId = randomUUID();
      assert.throws(
        () => DistributorHierarchy.create({
          id: randomUUID(),
          tenantId,
          parentDistributorId: distId,
          childDistributorId: distId,
          hierarchyLevel: 'DISTRIBUTOR',
          territory: 'North Region',
          effectiveFrom: '2026-01-01',
        }),
        /cannot be its own parent/
      );
    });

    test('validates parent level rank relative to child level rank', () => {
      // Superior: SUPER_STOCKIST (rank 1), Inferior: DISTRIBUTOR (rank 3)
      assert.doesNotThrow(() => DistributorHierarchy.validateParentLevel('SUPER_STOCKIST', 'DISTRIBUTOR'));

      // Invalid: DISTRIBUTOR (rank 3) as parent of SUPER_STOCKIST (rank 1)
      assert.throws(
        () => DistributorHierarchy.validateParentLevel('DISTRIBUTOR', 'SUPER_STOCKIST'),
        /must be higher than child level/
      );
    });

    test('activates and deactivates hierarchy state with domain events', () => {
      const h = DistributorHierarchy.create({
        id: randomUUID(),
        tenantId,
        parentDistributorId: randomUUID(),
        childDistributorId: randomUUID(),
        hierarchyLevel: 'CNF',
        territory: 'South Region',
        effectiveFrom: '2026-01-01',
      });

      assert.strictEqual(h.isActive, true);
      assert.strictEqual(h.domainEvents.length, 1);

      h.deactivate();
      assert.strictEqual(h.isActive, false);
      assert.notStrictEqual(h.effectiveTo, undefined);
      assert.strictEqual(h.domainEvents.length, 2);

      h.activate();
      assert.strictEqual(h.isActive, true);
      assert.strictEqual(h.effectiveTo, undefined);
      assert.strictEqual(h.domainEvents.length, 3);
    });
  });

  describe('KYCDocument Domain Aggregate', () => {
    test('creates, verifies and rejects KYC document invariants', () => {
      const doc = KYCDocument.create({
        id: randomUUID(),
        tenantId,
        distributorId: randomUUID(),
        documentType: 'GSTIN',
        documentNumber: '29ABCDE1234F1Z5',
      });

      assert.strictEqual(doc.verificationStatus, 'PENDING');

      doc.verify('verifier-admin-uuid');
      assert.strictEqual(doc.verificationStatus, 'VERIFIED');
      assert.strictEqual(doc.verifiedBy, 'verifier-admin-uuid');

      assert.throws(() => doc.verify('another-user'), /Cannot verify document in VERIFIED status/);
    });

    test('checks required verified documents helper', () => {
      const distId = randomUUID();
      const gstin = KYCDocument.create({
        id: randomUUID(),
        tenantId,
        distributorId: distId,
        documentType: 'GSTIN',
        documentNumber: '29ABCDE1234F1Z5',
      });
      gstin.verify('admin-1');

      const check1 = KYCDocument.hasRequiredVerifiedDocs([gstin]);
      assert.strictEqual(check1.valid, false);
      assert.deepStrictEqual(check1.missing, ['PAN']);

      const pan = KYCDocument.create({
        id: randomUUID(),
        tenantId,
        distributorId: distId,
        documentType: 'PAN',
        documentNumber: 'ABCDE1234F',
      });
      pan.verify('admin-1');

      const check2 = KYCDocument.hasRequiredVerifiedDocs([gstin, pan]);
      assert.strictEqual(check2.valid, true);
      assert.strictEqual(check2.missing.length, 0);
    });
  });

  describe('DistributorHierarchy Use Cases & Repositories', () => {
    test('executes Get, Update, and List use cases with optimistic locking', async () => {
      const repo = new DistributorHierarchyPgRepository(mockDb);
      const getUseCase = new GetDistributorHierarchyUseCase(repo);
      const updateUseCase = new UpdateDistributorHierarchyUseCase(repo);
      const listUseCase = new ListDistributorHierarchiesUseCase(repo);

      const parentId = randomUUID();
      const childId = randomUUID();
      const h = DistributorHierarchy.create({
        id: randomUUID(),
        tenantId,
        parentDistributorId: parentId,
        childDistributorId: childId,
        hierarchyLevel: 'SUPER_STOCKIST',
        territory: 'Central Region',
        effectiveFrom: '2026-01-01',
      });

      await repo.save(h);

      // Get Use Case
      const fetched = await getUseCase.execute(principal, h.id);
      assert.notStrictEqual(fetched, null);
      assert.strictEqual(fetched?.id, h.id);

      // List Use Case
      const list = await listUseCase.execute(principal, { page: 1, pageSize: 10 });
      assert.strictEqual(list.total, 1);
      assert.strictEqual(list.data[0].id, h.id);

      // Update Use Case with Optimistic Concurrency Failure
      await assert.rejects(
        () => updateUseCase.execute(principal, h.id, { isActive: false, version: 999 }),
        /Optimistic locking failure/
      );

      // Update Use Case Success
      const updated = await updateUseCase.execute(principal, h.id, { isActive: false, version: 1 });
      assert.strictEqual(updated.isActive, false);
      assert.strictEqual(updated.version, 2);
    });
  });
});
